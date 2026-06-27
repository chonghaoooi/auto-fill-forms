type Profile = {
  name: string;
  adminNumber: string;
  class: string;
  emails: string[];
  activeEmailIndex: number;
};

type Settings = {
  enabled: boolean;
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
  enabled: true,
  localModelBaseUrl: "http://localhost:11434",
  modelName: "qwen2.5:0.5b"
};

const PROFILE_KEYS = ["name", "adminNumber", "class", "email", "none"] as const;

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
