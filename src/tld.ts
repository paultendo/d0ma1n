import { buildPrototypeBuckets } from "./reverse-map.js";
import type { PrototypeBuckets } from "./types.js";
import { MULTI_SUFFIXES, SUFFIX_EXCEPTIONS as EXCEPTIONS, WILDCARD_SUFFIXES } from "./suffix-data.js";

const MULTI_SUFFIX_SET = new Set(MULTI_SUFFIXES);
const WILDCARD_SET = new Set(WILDCARD_SUFFIXES);
const SUFFIX_EXCEPTIONS = new Set(EXCEPTIONS);

/** Common TLDs for scanning. */
export const DEFAULT_TLDS = ["com", "net", "org", "io"];

/** Script-relevant IDN TLDs. */
export const IDN_TLDS: Record<string, string[]> = {
  Cyrillic: ["xn--p1ai"], // .рф
  Arabic: ["xn--mgbaam7a8h"], // .امارات
  Han: ["xn--fiqs8s", "xn--fiqz9s"], // .中国, .中國
  Korean: ["xn--3e0b707e"], // .한국
  Thai: ["xn--o3cw4h"], // .ไทย
  Devanagari: ["xn--h2brj9c"], // .भारत
};

/** The script a script-specific IDN TLD accepts, or undefined for a TLD open to several. */
export function tldScript(tld: string): string | undefined {
  for (const [script, tlds] of Object.entries(IDN_TLDS)) if (tlds.includes(tld)) return script;
  return undefined;
}

/**
 * Split a domain into its registrable label and its public suffix, by the longest suffix the Public Suffix List's
 * ICANN section knows: bank.co.za is "bank" under co.za, and paypal.com is "paypal" under com.
 */
export function splitDomain(domain: string): { label: string; tld: string } {
  const lower = domain.toLowerCase().replace(/\.$/, ""); // strip trailing dot
  const parts = lower.split(".");
  if (parts.length === 1) return { label: lower, tld: "com" };
  // The longest suffix wins, but the label must keep at least one part
  for (let i = 1; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join(".");
    const parent = parts.slice(i + 1).join(".");
    // An exception (!city.kawasaki.jp) is registrable itself: its parent is the suffix
    if (SUFFIX_EXCEPTIONS.has(suffix)) return { label: parts.slice(0, i + 1).join("."), tld: parent };
    if (MULTI_SUFFIX_SET.has(suffix) || WILDCARD_SET.has(parent)) {
      return { label: parts.slice(0, i).join("."), tld: suffix };
    }
  }
  return { label: parts.slice(0, -1).join("."), tld: parts[parts.length - 1]! };
}

/**
 * Generate confusable TLD variants.
 * E.g., "com" with Cyrillic "o" -> "cоm" (xn--cm-pmc).
 */
export function generateTldVariants(
  tld: string,
  buckets?: PrototypeBuckets
): string[] {
  const protoBuckets = buckets ?? buildPrototypeBuckets();
  const chars = [...tld.toLowerCase()];
  const variants: string[] = [];
  const seen = new Set<string>();

  // Only 1-edit on TLDs (2-edit TLD variants are unlikely to be registered)
  for (let i = 0; i < chars.length; i++) {
    const proto = chars[i];
    const subs = protoBuckets[proto];
    if (!subs) continue;

    for (const sub of subs.slice(0, 5)) {
      const mutated = [...chars];
      mutated[i] = sub.char;
      const variant = mutated.join("");
      if (!seen.has(variant)) {
        seen.add(variant);
        variants.push(variant);
      }
    }
  }

  return variants;
}

/**
 * Get all TLDs to check for a scan, optionally including IDN TLDs
 * relevant to detected scripts and confusable TLD variants.
 */
export function getTargetTlds(options: {
  baseTlds?: string[];
  tldVariants?: boolean;
  scripts?: Set<string>;
}): string[] {
  const tlds = new Set(options.baseTlds ?? DEFAULT_TLDS);

  // Add script-relevant IDN TLDs
  if (options.scripts) {
    for (const script of options.scripts) {
      const idnTlds = IDN_TLDS[script];
      if (idnTlds) {
        for (const t of idnTlds) tlds.add(t);
      }
    }
  }

  // Add confusable TLD variants
  if (options.tldVariants) {
    for (const tld of [...tlds]) {
      const variants = generateTldVariants(tld);
      for (const v of variants) tlds.add(v);
    }
  }

  return [...tlds];
}
