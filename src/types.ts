import type { ConfusableWeight, ConfusableWeights } from "namespace-guard";

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
  /** SSIM danger score for this pair. */
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
  /** Font where this variant scores highest SSIM. */
  bestFont?: string;
  /** Highest font-specific SSIM for this variant. */
  bestFontSsim?: number;
  /** Punycode (ACE) form of the domain. */
  punycode: string;
  /** DNS resolution data (only when --resolve is used). */
  dns?: DnsResult;
};

/** A confusable substitute for a given ASCII prototype character. */
export type ConfusableSubstitute = {
  /** The confusable source character. */
  char: string;
  /** Unicode codepoint string. */
  codepoint: string;
  /** Unicode script name. */
  script: string;
  /** Max SSIM danger score. */
  danger: number;
  /** p95 SSIM stable danger score. */
  stableDanger: number;
  /** Whether this char is IDNA PVALID. */
  idnaPvalid: boolean;
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
  /** Use max SSIM instead of p95 for scoring (default: false). */
  useMaxDanger?: boolean;
};

/** Options for scoring. */
export type ScoreOptions = {
  /** Use max SSIM instead of p95 for scoring. */
  useMaxDanger?: boolean;
  /** Font name for font-specific scoring. */
  font?: string;
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
