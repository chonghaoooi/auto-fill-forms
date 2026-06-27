type BackgroundProfileKey = "name" | "adminNumber" | "phoneNumber" | "class" | "email" | "none";

type BackgroundExtractedField = {
  id: string;
  label?: string;
  helper?: string;
  placeholder?: string;
  aria?: string;
  type?: string;
  options?: string[];
};

type BackgroundClassificationResult = {
  fieldId: string;
  profileKey: BackgroundProfileKey;
};

declare const importScripts: (...urls: string[]) => void;

try {
  importScripts("defaults.js");
} catch (_) {
  // Tests load defaults via CommonJS; Chrome extension runtime uses require.
}

const backgroundDefaults = typeof module !== "undefined" ? require("./defaults.js") : {};
const bgProfileKeys = (typeof PROFILE_KEYS !== "undefined" ? PROFILE_KEYS : backgroundDefaults.PROFILE_KEYS) as readonly BackgroundProfileKey[];

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: unknown) => void) => {
    if (!message || message.type !== "CLASSIFY_FIELDS") {
      return false;
    }

    sendResponse({ ok: true, results: classifyFields(message.fields || []) });
    return false;
  });
}

function classifyFields(fields: BackgroundExtractedField[]): BackgroundClassificationResult[] {
  return fields.map((field) => ({
    fieldId: field.id,
    profileKey: classifyField(field)
  }));
}

function classifyField(field: BackgroundExtractedField): BackgroundProfileKey {
  const text = normalizeFieldText(field);
  const type = String(field.type || "").toLocaleLowerCase();

  if (type === "email" || /\be-?mail\b|mail address/.test(text)) {
    return "email";
  }
  if (type === "tel" || /\b(phone|mobile|cell|contact\s*(number|no)?|telephone|tel|handphone|hp)\b/.test(text)) {
    return "phoneNumber";
  }
  if (/\badmin(istration)?\s*(no|number|#)?\b|\badmission\s*(no|number)\b|\bstudent\s*(id|number|no)\b/.test(text)) {
    return "adminNumber";
  }
  if (/\bclass\b|\bgroup\b|\bform\b|\bcohort\b/.test(text)) {
    return "class";
  }
  if (/\bname\b|名字|姓名/.test(text)) {
    return "name";
  }
  return "none";
}

function normalizeFieldText(field: BackgroundExtractedField): string {
  return [
    field.label,
    field.helper,
    field.placeholder,
    field.aria,
    ...(field.options || [])
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function normalizeProfileKey(value: unknown): BackgroundProfileKey {
  return (bgProfileKeys as readonly unknown[]).includes(value) ? value as BackgroundProfileKey : "none";
}

if (typeof module !== "undefined") {
  module.exports = {
    classifyField,
    classifyFields,
    normalizeFieldText,
    normalizeProfileKey
  };
}
