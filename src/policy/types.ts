export type DomainBrowserProfileName = "chromium" | "firefox" | "unicode-all";

export type DomainRegistryProfileName =
  | "verisign-com"
  | "verisign-net"
  | "generic-idn-strict"
  | "japanese-idn";

export type DomainDecision = "allow" | "warn" | "review" | "block";

export type DomainRiskReasonCode =
  | "ascii-safe"
  | "mixed-script-label"
  | "single-script-non-latin"
  | "whole-script-spoof"
  | "confusable-match"
  | "cross-script-confusable"
  | "displayed-as-punycode"
  | "displayed-as-unicode"
  | "non-pvalid-character"
  | "registrable-under-profile"
  | "not-registrable-under-profile"
  | "script-not-supported"
  | "high-danger"
  | "moderate-danger"
  | "target-mismatch"
  | "registered"
  | "decoded-by-camera";

export type DomainRiskReason = {
  code: DomainRiskReasonCode;
  message: string;
  weight: number;
};

export type DomainDisplayMode = "ascii" | "unicode" | "punycode";

/**
 * How a domain shows on the surfaces where people decide to trust it. Chromium and the phone cameras follow recorded
 * tests of how each displays lookalikes. Firefox is modelled from its IDN policy, not tested.
 */
export type DomainSurfaces = {
  chromium: DomainDisplayMode;
  firefox: DomainDisplayMode;
  androidCamera: DomainDisplayMode;
  iosCamera: DomainDisplayMode;
};

export type DomainLabelAssessment = {
  kind: "label";
  label: string;
  tld: string;
  normalizedLabel: string;
  scripts: string[];
  displayMode: DomainDisplayMode;
  registrable: boolean;
  decision: DomainDecision;
  score: number;
  reasons: DomainRiskReason[];
  notes: string[];
};

export type DomainSpoofSubstitution = {
  index: number;
  from: string;
  to: string;
  similarity: number;
};

export type DomainSpoofAssessment = {
  kind: "spoof";
  label: string;
  target: string;
  tld: string;
  normalizedLabel: string;
  normalizedTarget: string;
  scripts: string[];
  displayMode: DomainDisplayMode;
  registrable: boolean;
  registered?: boolean;
  surfaces: DomainSurfaces;
  decision: DomainDecision;
  score: number;
  danger: number;
  spoof: boolean;
  script?: string;
  substitutions: DomainSpoofSubstitution[];
  reasons: DomainRiskReason[];
  notes: string[];
};

export type DomainPolicyProfile = {
  name: DomainRegistryProfileName;
  browser: DomainBrowserProfileName;
  allowMixedScripts: boolean;
  allowedScripts?: string[];
  blockThreshold: number;
  reviewThreshold: number;
  warnThreshold: number;
  notes: string[];
};

export type EvaluateDomainLabelOptions = {
  tld?: string;
  browser?: DomainBrowserProfileName;
  profile?: DomainPolicyProfile;
};

export type EvaluateDomainSpoofOptions = EvaluateDomainLabelOptions & {
  /** The domain is known to exist (for example from DNS). Whether a registry would accept it today then no longer
   * matters: some registered lookalikes predate the rules that now refuse them. */
  registered?: boolean;
  minDanger?: number;
  allowlist?: string[];
  observedSubstitutions?: DomainSpoofSubstitution[];
};

export type DomainPolicyEvaluator = {
  profile: DomainPolicyProfile;
  evaluateLabel: (label: string, options?: Omit<EvaluateDomainLabelOptions, "profile">) => DomainLabelAssessment;
  evaluateSpoof: (
    label: string,
    target: string,
    options?: Omit<EvaluateDomainSpoofOptions, "profile">,
  ) => DomainSpoofAssessment;
};
