type ContentProfileKey = "name" | "adminNumber" | "phoneNumber" | "class" | "email" | "none";

type ContentExtractedField = {
  id: string;
  type: string;
  label: string;
  helper: string;
  placeholder: string;
  aria: string;
  options: string[];
};

type ContentClassificationResult = {
  fieldId: string;
  profileKey: ContentProfileKey;
};

type ContentState = {
  fields: ContentExtractedField[];
  settings: Settings;
  profile: Profile;
  touched: WeakSet<Element>;
};

(async function initAutofill() {
  const state: ContentState = {
    fields: [],
    settings: { ...DEFAULT_SETTINGS },
    profile: { ...DEFAULT_PROFILE },
    touched: new WeakSet()
  };

  document.addEventListener("input", (event) => {
    if (event.isTrusted && isFillable(event.target)) {
      state.touched.add(event.target);
    }
  }, true);

  const scanAndClassify = debounce(async () => {
    const { profile, settings } = await chrome.storage.local.get({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS
    });
    state.profile = { ...DEFAULT_PROFILE, ...profile };
    state.settings = { ...DEFAULT_SETTINGS, ...settings };
    if (!state.settings.enabled) {
      removeInlineAutofillUi();
      return;
    }
    state.fields = extractFields();

    if (state.fields.length === 0) {
      return;
    }

    chrome.runtime.sendMessage({ type: "CLASSIFY_FIELDS", fields: state.fields }, (response?: { results?: ContentClassificationResult[] }) => {
      if (chrome.runtime.lastError) {
        console.warn("Form Autofill message failed", chrome.runtime.lastError);
        return;
      }
      if (!state.settings.enabled) {
        removeInlineAutofillUi();
        return;
      }
      applyClassificationResults(response?.results || []);
    });
  }, 350);

  scanAndClassify();
  new MutationObserver(scanAndClassify).observe(document.body, { childList: true, subtree: true });
  chrome.storage.onChanged?.addListener((changes: Record<string, { newValue?: Settings }>, areaName: string) => {
    if (areaName === "local" && changes.settings) {
      state.settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
      if (!state.settings.enabled) {
        removeInlineAutofillUi();
      } else {
        scanAndClassify();
      }
    }
  });

  function extractFields(): ContentExtractedField[] {
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .filter(isFillable)
      .map((control, index) => {
        const id = control.dataset.aiAutofillId || `ai-autofill-${Date.now()}-${index}`;
        control.dataset.aiAutofillId = id;
        return {
          id,
          type: getFieldType(control),
          label: normalizeText(findLabelText(control)),
          helper: normalizeText(findHelperText(control)),
          placeholder: normalizeText(control.getAttribute("placeholder") || ""),
          aria: normalizeText(getAriaText(control)),
          options: getOptionLabels(control).map(normalizeText)
        };
      });
  }

  function applyClassificationResults(results: ContentClassificationResult[]): void {
    for (const result of results) {
      const field = state.fields.find((item) => item.id === result.fieldId);
      const control = field && document.querySelector(`[data-ai-autofill-id="${cssEscape(field.id)}"]`);
      if (!isFillable(control) || result.profileKey === "none" || state.touched.has(control) || hasUserValue(control)) {
        continue;
      }
      if (control instanceof HTMLInputElement && ["radio", "checkbox"].includes(control.type)) {
        continue;
      }

      const value = valueForProfileKey(result.profileKey);
      if (!value) {
        continue;
      }

      setNativeValue(control, value);
      if (result.profileKey === "email") {
        renderEmailChooser(control);
      }
    }
  }

  function valueForProfileKey(key: Exclude<ContentProfileKey, "none">): string {
    if (key === "email") {
      const emails = Array.isArray(state.profile.emails) ? state.profile.emails : [];
      return emails[state.profile.activeEmailIndex || 0] || emails.find(Boolean) || "";
    }
    return state.profile[key] || "";
  }

  function renderEmailChooser(control: FillableControl): void {
    const emails = (state.profile.emails || []).filter(Boolean);
    if (emails.length < 2) {
      return;
    }

    const bubble = makeBubble(control, "ai-autofill-email-picker");
    bubble.innerHTML = "";
    const title = document.createElement("div");
    title.className = "ai-autofill-picker-title";
    title.textContent = "Use another saved email";
    bubble.append(title);

    const list = document.createElement("div");
    list.className = "ai-autofill-picker-list";
    for (const [index, email] of emails.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.profile.activeEmailIndex ? "is-active" : "";
      button.textContent = email;
      button.addEventListener("click", async () => {
        setNativeValue(control, email);
        state.profile.activeEmailIndex = index;
        await chrome.storage.local.set({ profile: state.profile });
        renderEmailChooser(control);
      });
      list.append(button);
    }
    bubble.append(list);
  }
})();

type FillableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isFillable(element: unknown): element is FillableControl {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return false;
  }
  if (element.disabled || (!(element instanceof HTMLSelectElement) && element.readOnly)) {
    return false;
  }
  const type = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase();
  return !["hidden", "submit", "button", "reset", "file", "image", "password"].includes(type);
}

function getFieldType(control: FillableControl): string {
  if (control instanceof HTMLInputElement) {
    return control.type || "text";
  }
  return control.tagName.toLowerCase();
}

function findLabelText(control: FillableControl): string {
  const explicit = control.id ? document.querySelector(`label[for="${cssEscape(control.id)}"]`) : null;
  const wrapping = control.closest("label");
  const formBlock = control.closest("[role='listitem'], [data-automation-id='questionItem'], .freebirdFormviewerViewItemsItemItem, div");
  return [
    explicit?.textContent,
    wrapping?.textContent,
    formBlock?.querySelector("[role='heading'], [data-automation-id='questionTitle'], .freebirdFormviewerComponentsQuestionBaseTitle")?.textContent,
    nearestTextBefore(control)
  ].filter(Boolean).join(" ");
}

function findHelperText(control: FillableControl): string {
  const describedBy = textFromIdList(control.getAttribute("aria-describedby"));
  const formBlock = control.closest("[role='listitem'], [data-automation-id='questionItem'], .freebirdFormviewerViewItemsItemItem, div");
  return [
    describedBy,
    formBlock?.querySelector("[data-automation-id='questionSubTitle'], .freebirdFormviewerComponentsQuestionBaseHelpText")?.textContent
  ].filter(Boolean).join(" ");
}

function getAriaText(control: FillableControl): string {
  return [
    control.getAttribute("aria-label"),
    textFromIdList(control.getAttribute("aria-labelledby")),
    textFromIdList(control.getAttribute("aria-describedby"))
  ].filter(Boolean).join(" ");
}

function textFromIdList(value: string | null): string {
  return String(value || "")
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent || "")
    .filter(Boolean)
    .join(" ");
}

function getOptionLabels(control: FillableControl): string[] {
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.options).map((option) => option.textContent || option.value);
  }
  const group = control.closest("[role='radiogroup'], [role='group'], [role='listitem']");
  return group ? Array.from(group.querySelectorAll("label, [role='radio'], [role='checkbox']")).map((item) => item.textContent || "") : [];
}

function nearestTextBefore(control: FillableControl): string {
  let node = control.previousElementSibling;
  while (node) {
    const text = normalizeText(node.textContent || "");
    if (text) {
      return text;
    }
    node = node.previousElementSibling;
  }
  return "";
}

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}@._/# -]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function hasUserValue(control: FillableControl): boolean {
  if (control instanceof HTMLSelectElement) {
    return Boolean(control.value);
  }
  return Boolean(control.value && String(control.value).trim());
}

function setNativeValue(control: FillableControl, value: string): void {
  const prototype = Object.getPrototypeOf(control);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(control, value);
  } else {
    control.value = value;
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function makeBubble(control: FillableControl, className: string): HTMLDivElement {
  ensureAutofillStyles();
  const host = control.closest("[role='listitem'], [data-automation-id='questionItem'], .freebirdFormviewerViewItemsItemItem") || control.parentElement;
  const existing = host?.querySelector<HTMLDivElement>(`.${className}`);
  if (existing) {
    return existing;
  }
  const bubble = document.createElement("div");
  bubble.className = className;
  if (host && host !== control.parentElement) {
    host.append(bubble);
  } else {
    control.insertAdjacentElement("afterend", bubble);
  }
  return bubble;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function ensureAutofillStyles(): void {
  if (document.getElementById("ai-autofill-inline-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "ai-autofill-inline-styles";
  style.textContent = `
    .ai-autofill-email-picker {
      box-sizing: border-box;
      display: block;
      width: min(100%, 420px);
      margin: 12px 0 0;
      clear: both;
      border: 1px solid #d6e2f0;
      border-radius: 10px;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      color: #17202a;
      font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      z-index: 2147483647;
    }

    .ai-autofill-picker-title {
      margin-bottom: 8px;
      color: #526173;
      font-size: 12px;
      font-weight: 700;
    }

    .ai-autofill-picker-list {
      display: grid;
      gap: 6px;
    }

    .ai-autofill-picker-list button {
      width: 100%;
      border: 1px solid #d8e2ef;
      border-radius: 8px;
      padding: 8px 10px;
      color: #1f2937;
      background: #f8fbff;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .ai-autofill-picker-list button:hover,
    .ai-autofill-picker-list button.is-active {
      border-color: #2f6fe4;
      background: #edf4ff;
      color: #174ea6;
    }
  `;
  document.head.append(style);
}

function removeInlineAutofillUi(): void {
  document.querySelectorAll(".ai-autofill-email-picker").forEach((node) => node.remove());
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: number | undefined;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  }) as T;
}
