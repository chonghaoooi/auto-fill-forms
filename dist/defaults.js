"use strict";
const DEFAULT_PROFILE = {
    name: "",
    adminNumber: "",
    phoneNumber: "",
    class: "",
    emails: [""],
    activeEmailIndex: 0
};
const DEFAULT_SETTINGS = {
    enabled: true
};
const PROFILE_KEYS = ["name", "adminNumber", "phoneNumber", "class", "email", "none"];
if (typeof module !== "undefined") {
    module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
