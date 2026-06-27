try {
  importScripts("defaults.js");
} catch (_) {
  // Tests load defaults via CommonJS; Chrome extension runtime uses importScripts.
}

if (typeof module !== "undefined") {
  var { DEFAULT_SETTINGS, PROFILE_KEYS } = require("./defaults.js");
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  const { settings } = await chrome.storage.local.get({ settings: DEFAULT_SETTINGS });
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

async function classifyOneField(field, settings) {
  const baseUrl = String(settings.localModelBaseUrl || DEFAULT_SETTINGS.localModelBaseUrl).replace(/\/+$/, "");
  const prompt = buildPrompt(field);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.modelName || DEFAULT_SETTINGS.modelName,
      prompt,
      stream: false,
      format: "json",
      keep_alive: "30s",
      options: {
        temperature: 0
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Local model request failed with ${response.status}`);
  }

  const payload = await response.json();
  return parseModelJson(payload.response || payload.message?.content || "{}");
}

function buildPrompt(field) {
  return [
    "You classify a browser form field into exactly one saved profile key.",
    `Allowed keys: ${PROFILE_KEYS.join(", ")}.`,
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
  } catch (_) {
    return { profileKey: "none", confidence: 0 };
  }
}

function normalizeProfileKey(value) {
  return PROFILE_KEYS.includes(value) ? value : "none";
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
    } else if (/\badmin(istration)?\s*(no|number|#)?\b|\badmission\s*(no|number)\b/.test(text)) {
      profileKey = "adminNumber";
      confidence = 0.72;
    } else if (/\bclass\b|\bgroup\b|\bform\b|\bcohort\b/.test(text)) {
      profileKey = "class";
      confidence = 0.68;
    } else if (/\bdate\b|\bdob\b|birth/.test(text) || type === "date") {
      profileKey = "date";
      confidence = 0.7;
    } else if (/\bname\b|名字|姓名/.test(text)) {
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
    fallbackClassify
  };
}
