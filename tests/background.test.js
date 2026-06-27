const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseModelJson,
  normalizeProfileKey,
  clampConfidence,
  fallbackClassify,
  buildPrompt,
  warmModel,
  unloadModel
} = require("../dist/background.js");

test("parseModelJson extracts JSON from model text", () => {
  assert.deepEqual(parseModelJson('{"profileKey":"email","confidence":0.93}'), {
    profileKey: "email",
    confidence: 0.93
  });
  assert.deepEqual(parseModelJson('Here: {"profileKey":"name","confidence":1}'), {
    profileKey: "name",
    confidence: 1
  });
});

test("profile keys and confidence are normalized", () => {
  assert.equal(normalizeProfileKey("email"), "email");
  assert.equal(normalizeProfileKey("phone"), "none");
  assert.equal(clampConfidence(2), 1);
  assert.equal(clampConfidence(-1), 0);
  assert.equal(clampConfidence("0.7"), 0.7);
});

test("fallback classifier covers common school form labels", () => {
  const results = fallbackClassify([
    { id: "1", label: "Admin no" },
    { id: "2", label: "What's ur name" },
    { id: "3", label: "School email address", type: "email" },
    { id: "4", label: "Class group" }
  ]);

  assert.equal(results[0].profileKey, "adminNumber");
  assert.equal(results[1].profileKey, "name");
  assert.equal(results[2].profileKey, "email");
  assert.equal(results[3].profileKey, "class");
});

test("prompt constrains model to classifier JSON", () => {
  const prompt = buildPrompt({ label: "Name per SAS", type: "text" });
  assert.match(prompt, /Allowed keys/);
  assert.match(prompt, /Return only JSON/);
  assert.match(prompt, /Name per SAS/);
});

test("model lifecycle warms then unloads Ollama model", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({ response: "{}" })
    };
  };

  try {
    const settings = {
      localModelBaseUrl: "http://localhost:11434",
      modelName: "smollm3:3b",
      autofillThreshold: 0.9,
      suggestThreshold: 0.6
    };
    await warmModel(settings);
    await unloadModel(settings);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls[0].keep_alive, "30s");
  assert.equal(calls[1].keep_alive, 0);
});
