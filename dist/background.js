"use strict";
try {
    importScripts("defaults.js");
}
catch (_) {
    // Tests load defaults via CommonJS; Chrome extension runtime uses require.
}
const backgroundDefaults = typeof module !== "undefined" ? require("./defaults.js") : {};
const bgProfileKeys = (typeof PROFILE_KEYS !== "undefined" ? PROFILE_KEYS : backgroundDefaults.PROFILE_KEYS);
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== "CLASSIFY_FIELDS") {
            return false;
        }
        sendResponse({ ok: true, results: classifyFields(message.fields || []) });
        return false;
    });
}
function classifyFields(fields) {
    return fields.map((field) => ({
        fieldId: field.id,
        profileKey: classifyField(field)
    }));
}
function classifyField(field) {
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
function normalizeFieldText(field) {
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
function normalizeProfileKey(value) {
    return bgProfileKeys.includes(value) ? value : "none";
}
if (typeof module !== "undefined") {
    module.exports = {
        classifyField,
        classifyFields,
        normalizeFieldText,
        normalizeProfileKey
    };
}
