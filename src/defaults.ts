type Profile = {
  name: string;
  date: string;
  adminNumber: string;
  class: string;
  emails: string[];
  activeEmailIndex: number;
};

type Settings = {
  autofillThreshold: number;
  suggestThreshold: number;
  localModelBaseUrl: string;
  modelName: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "",
  date: "",
  adminNumber: "",
  class: "",
  emails: [""],
  activeEmailIndex: 0
};

const DEFAULT_SETTINGS: Settings = {
  autofillThreshold: 0.9,
  suggestThreshold: 0.6,
  localModelBaseUrl: "http://localhost:11434",
  modelName: "qwen2.5:0.5b"
};

const PROFILE_KEYS = ["name", "date", "adminNumber", "class", "email", "none"] as const;

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
