import type {
  DomainBrowserProfileName,
  DomainPolicyProfile,
  DomainRegistryProfileName,
} from "./types.js";

const TLD_PROFILE_OVERRIDES: Record<string, DomainRegistryProfileName> = {
  com: "verisign-com",
  net: "verisign-net",
  jp: "japanese-idn",
  "co.jp": "japanese-idn",
  "or.jp": "japanese-idn",
  "ne.jp": "japanese-idn",
};

const PROFILES: Record<DomainRegistryProfileName, DomainPolicyProfile> = {
  "verisign-com": {
    name: "verisign-com",
    browser: "chromium",
    allowMixedScripts: false,
    allowedScripts: ["Latin", "Cyrillic", "Greek", "Arabic", "Hebrew", "Devanagari", "Thai", "Han", "Hiragana", "Katakana", "Hangul", "Georgian"],
    warnThreshold: 20,
    reviewThreshold: 45,
    blockThreshold: 70,
    notes: [
      "Treat labels as single-script under practical registrar policy.",
      "Mixed-script label substitutions are treated as non-registrable noise.",
    ],
  },
  "verisign-net": {
    name: "verisign-net",
    browser: "chromium",
    allowMixedScripts: false,
    allowedScripts: ["Latin", "Cyrillic", "Greek", "Arabic", "Hebrew", "Devanagari", "Thai", "Han", "Hiragana", "Katakana", "Hangul", "Georgian"],
    warnThreshold: 20,
    reviewThreshold: 45,
    blockThreshold: 70,
    notes: [
      "Mirrors the strict single-script framing used for .net risk evaluation.",
    ],
  },
  "generic-idn-strict": {
    name: "generic-idn-strict",
    browser: "chromium",
    allowMixedScripts: false,
    warnThreshold: 18,
    reviewThreshold: 42,
    blockThreshold: 68,
    notes: [
      "Default profile for non-Japanese registries with conservative single-script enforcement.",
    ],
  },
  "japanese-idn": {
    name: "japanese-idn",
    browser: "chromium",
    allowMixedScripts: true,
    allowedScripts: ["Latin", "Han", "Hiragana", "Katakana"],
    warnThreshold: 18,
    reviewThreshold: 40,
    blockThreshold: 64,
    notes: [
      "Allows Japanese mixed-script labels where Han, Hiragana, Katakana, and Latin commonly coexist.",
    ],
  },
};

export const DOMAIN_POLICY_PROFILES = PROFILES;

export function getDomainPolicyProfile(
  name: DomainRegistryProfileName = "generic-idn-strict",
  overrides?: Partial<DomainPolicyProfile>,
): DomainPolicyProfile {
  return {
    ...PROFILES[name],
    ...overrides,
    notes: overrides?.notes ?? PROFILES[name].notes,
  };
}

export function getDomainPolicyProfileForTld(
  tld: string,
  overrides?: Partial<DomainPolicyProfile>,
): DomainPolicyProfile {
  const normalized = tld.toLowerCase().replace(/^\.+/, "");
  const exact = TLD_PROFILE_OVERRIDES[normalized];

  if (exact) {
    return getDomainPolicyProfile(exact, overrides);
  }

  const labels = normalized.split(".");
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");
    const mapped = TLD_PROFILE_OVERRIDES[candidate];
    if (mapped) {
      return getDomainPolicyProfile(mapped, overrides);
    }
  }

  return getDomainPolicyProfile("generic-idn-strict", overrides);
}

export function listDomainPolicyProfiles(): DomainRegistryProfileName[] {
  return Object.keys(PROFILES) as DomainRegistryProfileName[];
}

export function isDomainPolicyProfileName(value: string): value is DomainRegistryProfileName {
  return value in PROFILES;
}

export function getDefaultBrowserForProfile(
  profile: DomainPolicyProfile,
  browser?: DomainBrowserProfileName,
): DomainBrowserProfileName {
  return browser ?? profile.browser;
}
