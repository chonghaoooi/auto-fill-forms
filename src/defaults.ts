type Profile = {
  name: string;
  adminNumber: string;
  class: string;
  emails: string[];
  activeEmailIndex: number;
};

type Settings = {
  localModelBaseUrl: string;
  modelName: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "",
  adminNumber: "",
  class: "",
  emails: [""],
  activeEmailIndex: 0
};

const DEFAULT_SETTINGS: Settings = {
  localModelBaseUrl: "http://localhost:11434",
  modelName: "qwen2.5:0.5b"
};

const PROFILE_KEYS = ["name", "adminNumber", "class", "email", "none"] as const;

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
