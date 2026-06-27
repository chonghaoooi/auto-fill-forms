type Profile = {
  name: string;
  adminNumber: string;
  phoneNumber: string;
  class: string;
  emails: string[];
  activeEmailIndex: number;
};

type Settings = {
  enabled: boolean;
};

const DEFAULT_PROFILE: Profile = {
  name: "",
  adminNumber: "",
  phoneNumber: "",
  class: "",
  emails: [""],
  activeEmailIndex: 0
};

const DEFAULT_SETTINGS: Settings = {
  enabled: true
};

const PROFILE_KEYS = ["name", "adminNumber", "phoneNumber", "class", "email", "none"] as const;

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_PROFILE, DEFAULT_SETTINGS, PROFILE_KEYS };
}
