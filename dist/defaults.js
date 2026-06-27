"use strict";
const DEFAULT_PROFILE = {
    name: "",
    adminNumber: "",
    class: "",
    emails: [""],
    activeEmailIndex: 0
};
const DEFAULT_SETTINGS = {
    autofillThreshold: 0.9,
    suggestThreshold: 0.6,
    localModelBaseUrl: "http://localhost:11434",
    modelName: "qwen2.5:0.5b"
};
const PROFILE_KEYS = ["name", "adminNumber", "class", "email", "none"];
if (typeof module !== "undefined") {
    module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
