import { buildPrototypeBuckets } from "./reverse-map.js";
import type { PrototypeBuckets } from "./types.js";

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

/** Split a domain into label + TLD at the last dot. */
export function splitDomain(domain: string): { label: string; tld: string } {
  // Handle multi-part TLDs (.co.uk, .com.au)
  const knownMultiPart = [
    "co.uk",
    "com.au",
    "co.nz",
    "co.jp",
    "com.br",
    "co.kr",
    "co.in",
    "com.mx",
    "com.cn",
    "org.uk",
    "net.au",
    "ac.uk",
  ];

  const lower = domain.toLowerCase().replace(/\.$/, ""); // strip trailing dot

  for (const tld of knownMultiPart) {
    if (lower.endsWith(`.${tld}`)) {
      const label = lower.slice(0, -(tld.length + 1));
      return { label, tld };
    }
  }

  const lastDot = lower.lastIndexOf(".");
  if (lastDot === -1) {
    return { label: lower, tld: "com" };
  }

  return {
    label: lower.slice(0, lastDot),
    tld: lower.slice(lastDot + 1),
  };
}

/**
 * Generate confusable TLD variants.
 * E.g., "com" with Cyrillic "o" -> "cоm" (xn--cm-pmc).
 */
export function generateTldVariants(
  tld: string,
  buckets?: PrototypeBuckets
): string[] {
  const protoBuckets = buckets ?? buildPrototypeBuckets({ maxPerChar: 5 });
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
