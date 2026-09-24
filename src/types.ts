import type { ConfusableWeight, ConfusableWeights } from "namespace-guard";
import type {
  DomainSurfaces,
  DomainDecision,
  DomainDisplayMode,
  DomainRegistryProfileName,
  DomainRiskReason,
} from "./policy/index.js";

/** A single character substitution in a domain variant. */
export type Substitution = {
  /** Position in the label (0-indexed). */
  position: number;
  /** Original ASCII character at this position. */
  original: string;
  /** Replacement confusable character. */
  replacement: string;
  /** Unicode codepoint (e.g. "U+0430"). */
  codepoint: string;
  /** Unicode script name (e.g. "Cyrillic"). */
  script: string;
  /** Unicode block name (e.g. "Phonetic Extensions"). */
  block: string;
  /** Danger score for this pair (max visual similarity across fonts). */
  danger: number;
  /** Stable (p95) danger score for this pair. */
  stableDanger: number;
  /** Whether this char is IDNA PVALID. */
  idnaPvalid: boolean;
};

/** DNS resolution result for a domain variant. */
export type DnsResult = {
  registered: boolean;
  a: string[];
  aaaa: string[];
  mx: { priority: number; exchange: string }[];
  ns: string[];
  hasMx: boolean;
  /** "active" = has MX (likely phishing), "parked" = A but no MX, "unregistered" = no records. */
  threatLevel: "active" | "parked" | "unregistered";
};

/** A generated domain variant with scoring and optional DNS data. */
export type DomainVariant = {
  /** Full domain including TLD (e.g. "pаypal.com"). */
  domain: string;
  /** Composite danger score 0-1. */
  dangerScore: number;
  /** Number of character substitutions. */
  editCount: number;
  /** Details of each substitution. */
  substitutions: Substitution[];
  /** Font where this variant scores highest visual similarity. */
  bestFont?: string;
  /** Highest font-specific visual similarity score for this variant. */
  bestFontScore?: number;
  /** True if this is a full single-script replacement of the entire label. */
  fullReplacement?: boolean;
  /** A mixed-script lookalike found by probing: kept because it is registered. */
  probe?: boolean;
  /** Punycode (ACE) form of the domain. */
  punycode: string;
  /** DNS resolution data (only when --resolve is used). */
  dns?: DnsResult;
  /** Policy-layer triage derived from confusable-policy. */
  policy?: DomainVariantPolicy;
};

/** Compact policy summary attached to scanned variants. */
export type DomainVariantPolicy = {
  /** Registry/browser policy profile used for this target TLD. */
  profile: DomainRegistryProfileName;
  /** Final decision for triage. */
  decision: DomainDecision;
  /** Weighted policy score 0-100. */
  score: number;
  /** Whether the candidate would likely render as Unicode or punycode. */
  displayMode: DomainDisplayMode;
  /** Whether the label survives the profile's registrability assumptions. */
  registrable: boolean;
  /** What registrable rests on: the registry's own character tables, its ASCII-only rule, or (unknown) script alone. */
  registryRules: "tables" | "ascii" | "unknown";
  /** Set once DNS shows the domain exists. */
  registered?: boolean;
  /** How Chromium, Firefox and phone camera banners would show it. */
  surfaces: DomainSurfaces;
  /** Whether the label is a realistic whole-script spoof of the target. */
  spoof: boolean;
  /** Spoof danger returned by the policy engine. */
  danger: number;
  /** Reason codes and weights explaining the decision. */
  reasons: DomainRiskReason[];
  /** Human-readable notes from the policy engine. */
  notes: string[];
};

/** A confusable substitute for a given ASCII prototype character. */
export type ConfusableSubstitute = {
  /** The confusable source character. */
  char: string;
  /** Unicode codepoint string. */
  codepoint: string;
  /** Unicode script name. */
  script: string;
  /** Max danger score (visual similarity across fonts). */
  danger: number;
  /** p95 stable danger score. */
  stableDanger: number;
  /** Whether this char is IDNA PVALID. */
  idnaPvalid: boolean;
  /** Whether this substitute is from a different script than the prototype. */
  crossScript?: boolean;
};

/** Reverse map: ASCII prototype to its confusable substitutes, sorted by danger. */
export type PrototypeBuckets = Record<string, ConfusableSubstitute[]>;

/** Options for variant generation. */
export type GenerateOptions = {
  /** Maximum simultaneous substitutions (default: 2). */
  maxEdits?: number;
  /** Maximum substitutes to try per character position (default: 10). */
  maxPerChar?: number;
  /** Hard cap on total variants generated (default: 5000). */
  maxVariants?: number;
  /** Include non-IDNA PVALID characters (default: false). */
  includeNonPvalid?: boolean;
  /** Use max danger instead of p95 for scoring (default: false). */
  useMaxDanger?: boolean;
  /** Script filtering mode for IDN-aware generation.
   *  - 'realistic': only same-script subs + whole-script replacement (default)
   *  - 'all': no script filtering (legacy behavior)
   */
  scriptMode?: 'realistic' | 'all';
};

/** Options for scoring. */
export type ScoreOptions = {
  /** Use max danger instead of p95 for scoring. */
  useMaxDanger?: boolean;
  /** Font name for font-specific scoring. */
  font?: string;
  /** Original label being protected, used for policy enrichment. */
  targetLabel?: string;
  /** Disable policy enrichment. Enabled by default when targetLabel is provided. */
  policy?: boolean;
  /** Override the policy profile instead of resolving it from the TLD. */
  policyProfile?: DomainRegistryProfileName;
};

/** Options for DNS resolution. */
export type ResolveOptions = {
  /** Max concurrent DNS lookups (default: 10). */
  concurrency?: number;
  /** Timeout per lookup in ms (default: 3000). */
  timeout?: number;
};

/** Full scan options combining all sub-options. */
export type ScanOptions = {
  /** Perform DNS resolution. */
  resolve?: boolean;
  /** Maximum results to return (default: 20). */
  top?: number;
  /** Minimum danger score threshold 0-1 (default: 0.0). */
  threshold?: number;
  /** TLDs to check (default: ["com", "net", "org", "io"]). */
  tlds?: string[];
  /** Also generate confusable TLD substitutions. */
  tldVariants?: boolean;
  /** Font name for font-specific scoring. */
  font?: string;
  /** Disable confusable-policy enrichment. */
  policy?: boolean;
  /** Override the policy profile used for all scored variants. */
  policyProfile?: DomainRegistryProfileName;
  /** When resolving, also probe one-substitution mixed-script variants and keep those that are registered
   * (default true). */
  probeMixedScript?: boolean;
  /** How many mixed-script probes to resolve, most alike first (default 60). */
  probeLimit?: number;
  /** DNS resolver to use instead of the Node one (the Worker passes DNS over HTTPS). */
  resolver?: { resolve(domain: string): Promise<DnsResult> };
  /** Prebuilt lookup buckets, to reuse across scans. */
  buckets?: PrototypeBuckets;
} & GenerateOptions &
  ResolveOptions & {
    useMaxDanger?: boolean;
  };

/** Result of a full scan. */
export type ScanResult = {
  /** The original domain that was scanned. */
  original: string;
  /** The label portion (without TLD). */
  label: string;
  /** The TLD portion. */
  tld: string;
  /** Total variants generated before filtering. */
  totalGenerated: number;
  /** Sorted, filtered variants. */
  variants: DomainVariant[];
};

/** Result of a reverse scan. */
export type ReverseScanResult = {
  /** The suspicious domain being analyzed. */
  domain: string;
  /** The punycode form if applicable. */
  punycode: string;
  /** Potential legitimate domains this could impersonate. */
  impersonates: {
    /** The legitimate domain. */
    domain: string;
    /** How closely it matches (0-1). */
    similarity: number;
    /** Which substitutions were detected. */
    substitutions: Substitution[];
  }[];
};

/** Output format for CLI. */
export type OutputFormat = "table" | "json" | "csv";

/** DNS resolver interface (swappable between Node and DoH). */
export type DnsResolver = {
  resolve(domain: string): Promise<DnsResult>;
};
