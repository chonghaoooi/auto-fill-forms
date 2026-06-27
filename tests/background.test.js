const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyField,
  classifyFields,
  normalizeFieldText,
  normalizeProfileKey
} = require("../dist/background.js");

test("profile keys are normalized", () => {
  assert.equal(normalizeProfileKey("email"), "email");
  assert.equal(normalizeProfileKey("phoneNumber"), "phoneNumber");
  assert.equal(normalizeProfileKey("phone"), "none");
});

test("local classifier covers common school form labels", () => {
  const results = classifyFields([
    { id: "1", label: "Admin no" },
    { id: "2", label: "What's ur name" },
    { id: "3", label: "School email address", type: "email" },
    { id: "4", label: "Class group" },
    { id: "5", label: "Mobile phone number", type: "tel" }
  ]);

  assert.equal(results[0].profileKey, "adminNumber");
  assert.equal(results[1].profileKey, "name");
  assert.equal(results[2].profileKey, "email");
  assert.equal(results[3].profileKey, "class");
  assert.equal(results[4].profileKey, "phoneNumber");
});

test("phone detection handles contact wording", () => {
  assert.equal(classifyField({ id: "1", label: "Contact no." }), "phoneNumber");
  assert.equal(classifyField({ id: "2", label: "Telephone" }), "phoneNumber");
});

test("field text is normalized from all context", () => {
  assert.equal(
    normalizeFieldText({ id: "1", label: " PHONE ", helper: "Number", placeholder: " Optional " }),
    "phone number optional"
  );
});
