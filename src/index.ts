// Core API
export { scan } from "./scan.js";
export { reverseScan, fromPunycode } from "./reverse-scan.js";
export { generateVariants } from "./generate.js";
export type { RawVariant } from "./generate.js";
export { scoreVariants, computeDangerScore, findBestFont, toPunycode } from "./score.js";
export { buildPrototypeBuckets, getDefaultBuckets, getScript, toCodepoint } from "./reverse-map.js";
export { splitDomain, getTargetTlds, generateTldVariants, DEFAULT_TLDS } from "./tld.js";
export { createNodeResolver } from "./resolve.js";

// Formatters
export {
  formatTable,
  formatJson,
  formatCsv,
  formatReverseTable,
  formatReverseJson,
  formatScanResult,
} from "./format.js";

// Types
export type {
  Substitution,
  DnsResult,
  DomainVariant,
  ConfusableSubstitute,
  PrototypeBuckets,
  GenerateOptions,
  ScoreOptions,
  ResolveOptions,
  ScanOptions,
  ScanResult,
  ReverseScanResult,
  OutputFormat,
  DnsResolver,
} from "./types.js";
