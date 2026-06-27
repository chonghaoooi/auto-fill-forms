"use strict";
const form = document.getElementById("profile-form");
const emailsContainer = document.getElementById("emails");
const errors = document.getElementById("errors");
const statusMessage = document.getElementById("status");
const addEmail = document.getElementById("add-email");
let currentProfile = { ...DEFAULT_PROFILE };
let currentSettings = { ...DEFAULT_SETTINGS };
document.addEventListener("DOMContentLoaded", loadState);
addEmail.addEventListener("click", () => {
    currentProfile.emails = [...(currentProfile.emails || []), ""];
    renderEmails();
});
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusMessage.textContent = "";
    errors.textContent = "";
    const profile = readProfile();
    const settings = readSettings();
    const validationErrors = validate(profile, settings);
    if (validationErrors.length) {
        errors.textContent = validationErrors.join(" ");
        return;
    }
    await chrome.storage.local.set({ profile, settings });
    currentProfile = profile;
    currentSettings = settings;
    statusMessage.textContent = "Saved.";
});
async function loadState() {
    const stored = await chrome.storage.local.get({
        profile: DEFAULT_PROFILE,
        settings: DEFAULT_SETTINGS
    });
    currentProfile = { ...DEFAULT_PROFILE, ...stored.profile };
    currentSettings = { ...DEFAULT_SETTINGS, ...stored.settings };
    for (const key of ["name", "date", "adminNumber", "class"]) {
        getInput(key).value = currentProfile[key] || "";
    }
    for (const key of ["localModelBaseUrl", "modelName", "autofillThreshold", "suggestThreshold"]) {
        getInput(key).value = String(currentSettings[key] ?? "");
    }
    renderEmails();
}
function renderEmails() {
    emailsContainer.innerHTML = "";
    const emails = currentProfile.emails?.length ? currentProfile.emails : [""];
    emails.forEach((email, index) => {
        const row = document.createElement("div");
        row.className = "email-row";
        const input = document.createElement("input");
        input.type = "email";
        input.value = email;
        input.placeholder = "email@example.com";
        input.addEventListener("input", () => {
            currentProfile.emails[index] = input.value;
        });
        const active = document.createElement("button");
        active.type = "button";
        active.textContent = currentProfile.activeEmailIndex === index ? "Default" : "Use";
        active.addEventListener("click", () => {
            currentProfile.activeEmailIndex = index;
            renderEmails();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "x";
        remove.addEventListener("click", () => {
            currentProfile.emails.splice(index, 1);
            currentProfile.activeEmailIndex = Math.max(0, Math.min(currentProfile.activeEmailIndex || 0, currentProfile.emails.length - 1));
            renderEmails();
        });
        row.append(input, active, remove);
        emailsContainer.append(row);
    });
}
function readProfile() {
    const emails = Array.from(emailsContainer.querySelectorAll("input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
    return {
        name: getInput("name").value.trim(),
        date: getInput("date").value,
        adminNumber: getInput("adminNumber").value.trim(),
        class: getInput("class").value.trim(),
        emails,
        activeEmailIndex: Math.max(0, Math.min(currentProfile.activeEmailIndex || 0, Math.max(0, emails.length - 1)))
    };
}
function readSettings() {
    return {
        localModelBaseUrl: getInput("localModelBaseUrl").value.trim() || DEFAULT_SETTINGS.localModelBaseUrl,
        modelName: getInput("modelName").value.trim() || DEFAULT_SETTINGS.modelName,
        autofillThreshold: Number(getInput("autofillThreshold").value),
        suggestThreshold: Number(getInput("suggestThreshold").value)
    };
}
function validate(profile, settings) {
    const validationErrors = [];
    if (profile.adminNumber && !/^\d{6}$/.test(profile.adminNumber)) {
        validationErrors.push("Admin number must be exactly 6 digits.");
    }
    if (profile.class && !/^[a-z0-9./ -]+$/i.test(profile.class)) {
        validationErrors.push("Class can use letters, numbers, spaces, dots, slashes, and hyphens.");
    }
    if (profile.emails.length === 0) {
        validationErrors.push("Add at least one email.");
    }
    if (profile.emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        validationErrors.push("Each email must be valid.");
    }
    if (!validThreshold(settings.suggestThreshold) || !validThreshold(settings.autofillThreshold)) {
        validationErrors.push("Thresholds must be numbers between 0 and 1.");
    }
    if (settings.suggestThreshold > settings.autofillThreshold) {
        validationErrors.push("Suggest threshold must not exceed autofill threshold.");
    }
    return validationErrors;
}
function validThreshold(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}
function getInput(id) {
    return document.getElementById(id);
}
