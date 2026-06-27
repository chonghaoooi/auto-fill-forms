"use strict";
try {
    importScripts("defaults.js");
}
catch (_) {
    // Tests load defaults via CommonJS; Chrome extension runtime uses importScripts.
}
const backgroundDefaults = typeof module !== "undefined" ? require("./defaults.js") : {};
const bgDefaultSettings = (typeof DEFAULT_SETTINGS !== "undefined" ? DEFAULT_SETTINGS : backgroundDefaults.DEFAULT_SETTINGS);
const bgProfileKeys = (typeof PROFILE_KEYS !== "undefined" ? PROFILE_KEYS : backgroundDefaults.PROFILE_KEYS);
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== "CLASSIFY_FIELDS") {
            return false;
        }
        classifyFields(message.fields || [])
            .then((results) => sendResponse({ ok: true, results }))
            .catch((error) => {
            console.warn("AI Form Autofill classification failed", error);
            sendResponse({ ok: false, error: error.message, results: fallbackClassify(message.fields || []) });
        });
        return true;
    });
}
async function classifyFields(fields) {
    const { settings } = await chrome.storage.local.get({ settings: bgDefaultSettings });
    await warmModel(settings);
    try {
        const results = [];
        for (const field of fields) {
            const modelResult = await classifyOneField(field, settings);
            results.push({
                fieldId: field.id,
                profileKey: normalizeProfileKey(modelResult.profileKey),
                confidence: clampConfidence(modelResult.confidence)
            });
        }
        return results;
    }
    finally {
        await unloadModel(settings);
    }
}
async function warmModel(settings) {
    await callOllamaGenerate(settings, {
        prompt: "Return only this JSON: {\"profileKey\":\"none\",\"confidence\":0}",
        keep_alive: "30s"
    });
}
async function unloadModel(settings) {
    try {
        await callOllamaGenerate(settings, {
            prompt: "",
            keep_alive: 0
        });
    }
    catch (error) {
        console.warn("AI Form Autofill model unload failed", error);
    }
}
async function classifyOneField(field, settings) {
    const payload = await callOllamaGenerate(settings, {
        prompt: buildPrompt(field),
        keep_alive: "30s"
    });
    return parseModelJson(payload.response || payload.message?.content || "{}");
}
async function callOllamaGenerate(settings, request) {
    const baseUrl = String(settings.localModelBaseUrl || bgDefaultSettings.localModelBaseUrl).replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: settings.modelName || bgDefaultSettings.modelName,
            prompt: request.prompt,
            stream: false,
            format: "json",
            keep_alive: request.keep_alive,
            options: {
                temperature: 0
            }
        })
    });
    if (!response.ok) {
        throw new Error(`Local model request failed with ${response.status}`);
    }
    return response.json();
}
function buildPrompt(field) {
    return [
        "You classify a browser form field into exactly one saved profile key.",
        `Allowed keys: ${bgProfileKeys.join(", ")}.`,
        "Return only JSON with profileKey and confidence from 0 to 1.",
        "Use none when the field is not asking for one of these details.",
        "",
        JSON.stringify({
            label: field.label || "",
            helper: field.helper || "",
            placeholder: field.placeholder || "",
            aria: field.aria || "",
            type: field.type || "",
            options: field.options || []
        })
    ].join("\n");
}
function parseModelJson(text) {
    const trimmed = String(text || "").trim();
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
        return { profileKey: "none", confidence: 0 };
    }
    try {
        return JSON.parse(match[0]);
    }
    catch (_) {
        return { profileKey: "none", confidence: 0 };
    }
}
function normalizeProfileKey(value) {
    return bgProfileKeys.includes(value) ? value : "none";
}
function clampConfidence(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 0;
    }
    return Math.max(0, Math.min(1, number));
}
function fallbackClassify(fields) {
    return fields.map((field) => {
        const text = `${field.label || ""} ${field.helper || ""} ${field.placeholder || ""} ${field.aria || ""}`.toLocaleLowerCase();
        const type = String(field.type || "").toLocaleLowerCase();
        let profileKey = "none";
        let confidence = 0.3;
        if (type === "email" || /\be-?mail\b|mail address/.test(text)) {
            profileKey = "email";
            confidence = 0.75;
        }
        else if (/\badmin(istration)?\s*(no|number|#)?\b|\badmission\s*(no|number)\b/.test(text)) {
            profileKey = "adminNumber";
            confidence = 0.72;
        }
        else if (/\bclass\b|\bgroup\b|\bform\b|\bcohort\b/.test(text)) {
            profileKey = "class";
            confidence = 0.68;
        }
        else if (/\bdate\b|\bdob\b|birth/.test(text) || type === "date") {
            profileKey = "date";
            confidence = 0.7;
        }
        else if (/\bname\b|名字|姓名/.test(text)) {
            profileKey = "name";
            confidence = 0.7;
        }
        return { fieldId: field.id, profileKey, confidence };
    });
}
if (typeof module !== "undefined") {
    module.exports = {
        buildPrompt,
        parseModelJson,
        normalizeProfileKey,
        clampConfidence,
        fallbackClassify,
        warmModel,
        unloadModel
    };
}
