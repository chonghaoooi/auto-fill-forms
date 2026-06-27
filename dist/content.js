"use strict";
(async function initAutofill() {
    const state = {
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
        state.fields = extractFields();
        if (state.fields.length === 0) {
            return;
        }
        chrome.runtime.sendMessage({ type: "CLASSIFY_FIELDS", fields: state.fields }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("AI Form Autofill message failed", chrome.runtime.lastError);
                return;
            }
            applyClassificationResults(response?.results || []);
        });
    }, 350);
    scanAndClassify();
    new MutationObserver(scanAndClassify).observe(document.body, { childList: true, subtree: true });
    function extractFields() {
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
    function applyClassificationResults(results) {
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
            if (result.confidence >= Number(state.settings.autofillThreshold ?? DEFAULT_SETTINGS.autofillThreshold)) {
                setNativeValue(control, value);
                if (result.profileKey === "email") {
                    renderEmailChooser(control);
                }
            }
            else if (result.confidence >= Number(state.settings.suggestThreshold ?? DEFAULT_SETTINGS.suggestThreshold)) {
                renderSuggestion(control, result.profileKey, value);
            }
        }
    }
    function valueForProfileKey(key) {
        if (key === "email") {
            const emails = Array.isArray(state.profile.emails) ? state.profile.emails : [];
            return emails[state.profile.activeEmailIndex || 0] || emails.find(Boolean) || "";
        }
        return state.profile[key] || "";
    }
    function renderSuggestion(control, key, value) {
        const bubble = makeBubble(control, "ai-autofill-suggestion");
        bubble.innerHTML = "";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Fill ${labelForKey(key)}`;
        button.addEventListener("click", () => {
            setNativeValue(control, value);
            bubble.remove();
            if (key === "email") {
                renderEmailChooser(control);
            }
        });
        bubble.append(button);
    }
    function renderEmailChooser(control) {
        const emails = (state.profile.emails || []).filter(Boolean);
        if (emails.length < 2) {
            return;
        }
        const bubble = makeBubble(control, "ai-autofill-email-picker");
        bubble.innerHTML = "";
        for (const [index, email] of emails.entries()) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = email;
            button.addEventListener("click", async () => {
                setNativeValue(control, email);
                state.profile.activeEmailIndex = index;
                await chrome.storage.local.set({ profile: state.profile });
            });
            bubble.append(button);
        }
    }
})();
function isFillable(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
        return false;
    }
    if (element.disabled || (!(element instanceof HTMLSelectElement) && element.readOnly)) {
        return false;
    }
    const type = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase();
    return !["hidden", "submit", "button", "reset", "file", "image", "password"].includes(type);
}
function getFieldType(control) {
    if (control instanceof HTMLInputElement) {
        return control.type || "text";
    }
    return control.tagName.toLowerCase();
}
function findLabelText(control) {
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
function findHelperText(control) {
    const describedBy = textFromIdList(control.getAttribute("aria-describedby"));
    const formBlock = control.closest("[role='listitem'], [data-automation-id='questionItem'], .freebirdFormviewerViewItemsItemItem, div");
    return [
        describedBy,
        formBlock?.querySelector("[data-automation-id='questionSubTitle'], .freebirdFormviewerComponentsQuestionBaseHelpText")?.textContent
    ].filter(Boolean).join(" ");
}
function getAriaText(control) {
    return [
        control.getAttribute("aria-label"),
        textFromIdList(control.getAttribute("aria-labelledby")),
        textFromIdList(control.getAttribute("aria-describedby"))
    ].filter(Boolean).join(" ");
}
function textFromIdList(value) {
    return String(value || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .filter(Boolean)
        .join(" ");
}
function getOptionLabels(control) {
    if (control instanceof HTMLSelectElement) {
        return Array.from(control.options).map((option) => option.textContent || option.value);
    }
    const group = control.closest("[role='radiogroup'], [role='group'], [role='listitem']");
    return group ? Array.from(group.querySelectorAll("label, [role='radio'], [role='checkbox']")).map((item) => item.textContent || "") : [];
}
function nearestTextBefore(control) {
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
function normalizeText(value) {
    return String(value || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}@._/# -]+/gu, " ")
        .trim()
        .toLocaleLowerCase();
}
function hasUserValue(control) {
    if (control instanceof HTMLSelectElement) {
        return Boolean(control.value);
    }
    return Boolean(control.value && String(control.value).trim());
}
function setNativeValue(control, value) {
    const prototype = Object.getPrototypeOf(control);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
        descriptor.set.call(control, value);
    }
    else {
        control.value = value;
    }
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
}
function makeBubble(control, className) {
    const existing = control.parentElement?.querySelector(`.${className}`);
    if (existing) {
        return existing;
    }
    const bubble = document.createElement("div");
    bubble.className = className;
    bubble.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font:12px system-ui,sans-serif;z-index:2147483647";
    control.insertAdjacentElement("afterend", bubble);
    return bubble;
}
function labelForKey(key) {
    return {
        name: "name",
        adminNumber: "admin number",
        class: "class",
        email: "email"
    }[key] || key;
}
function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) {
        return CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
}
function debounce(fn, delay) {
    let timer;
    return ((...args) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    });
}
