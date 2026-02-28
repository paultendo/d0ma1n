import { CONFUSABLE_MAP_FULL } from "namespace-guard";
import { CONFUSABLE_WEIGHTS } from "namespace-guard/confusable-weights";
import type { ConfusableWeights } from "namespace-guard";
import { getScript, toCodepoint } from "./reverse-map.js";
import { toPunycode } from "./score.js";
import { splitDomain } from "./tld.js";
import type { ReverseScanResult, Substitution } from "./types.js";

/**
 * Decode a punycode label (RFC 3492).
 * Minimal implementation covering the bootstring decode algorithm.
 */
function decodePunycodeLabel(input: string): string {
  if (!input.startsWith("xn--")) return input;
  const encoded = input.slice(4);

  const BASE = 36;
  const TMIN = 1;
  const TMAX = 26;
  const SKEW = 38;
  const DAMP = 700;
  const INITIAL_BIAS = 72;
  const INITIAL_N = 128;

  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;

  // Split at last delimiter
  const lastDelim = encoded.lastIndexOf("-");
  const basicChars = lastDelim > 0 ? [...encoded.slice(0, lastDelim)] : [];
  const output = [...basicChars];
  let pos = lastDelim > 0 ? lastDelim + 1 : 0;

  function adapt(delta: number, numPoints: number, first: boolean): number {
    delta = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((BASE - TMIN) * TMAX) / 2) {
      delta = Math.floor(delta / (BASE - TMIN));
      k += BASE;
    }
    return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
  }

  function digitValue(c: string): number {
    const cp = c.charCodeAt(0);
    if (cp >= 0x30 && cp <= 0x39) return cp - 0x30 + 26; // 0-9
    if (cp >= 0x41 && cp <= 0x5a) return cp - 0x41; // A-Z
    if (cp >= 0x61 && cp <= 0x7a) return cp - 0x61; // a-z
    return BASE;
  }

  while (pos < encoded.length) {
    const oldi = i;
    let w = 1;
    let k = BASE;

    while (true) {
      if (pos >= encoded.length) break;
      const digit = digitValue(encoded[pos++]);
      if (digit >= BASE) break;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      k += BASE;
    }

    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    output.splice(i, 0, String.fromCodePoint(n));
    i++;
  }

  return output.join("");
}

/**
 * Decode a full punycode domain (handle each label).
 */
export function fromPunycode(domain: string): string {
  return domain
    .split(".")
    .map((label) => decodePunycodeLabel(label))
    .join(".");
}

/**
 * Reverse scan: given a suspicious domain, determine what legitimate
 * domain(s) it could be impersonating.
 *
 * Algorithm:
 * 1. Decode punycode if needed.
 * 2. For each non-ASCII char, look up its ASCII prototype via CONFUSABLE_MAP_FULL.
 * 3. Build the "canonical" (all-ASCII) label by replacing confusable chars.
 * 4. Score the similarity based on CONFUSABLE_WEIGHTS.
 */
export function reverseScan(domain: string): ReverseScanResult {
  const { label, tld } = splitDomain(domain);
  const punycode = toPunycode(domain);

  // Decode punycode if the input is in ACE form
  let decodedLabel = label;
  if (label.startsWith("xn--")) {
    decodedLabel = decodePunycodeLabel(label);
  }

  const chars = [...decodedLabel];
  const substitutions: Substitution[] = [];
  const canonicalChars: string[] = [];

  const weights = CONFUSABLE_WEIGHTS as ConfusableWeights;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const ascii = CONFUSABLE_MAP_FULL[ch];

    if (ascii && /^[a-z0-9]$/.test(ascii) && ch !== ascii) {
      // This is a confusable char; record the substitution
      const w =
        weights[ch]?.[ascii] ??
        weights[ascii]?.[ch] ??
        weights[ch]?.[ascii.toUpperCase()] ??
        weights[ascii.toUpperCase()]?.[ch];

      substitutions.push({
        position: i,
        original: ascii,
        replacement: ch,
        codepoint: toCodepoint(ch),
        script: getScript(ch),
        danger: w?.danger ?? 0.5,
        stableDanger: w?.stableDanger ?? 0.5,
        idnaPvalid: w?.idnaPvalid ?? false,
      });

      canonicalChars.push(ascii);
    } else {
      canonicalChars.push(ch);
    }
  }

  const canonicalLabel = canonicalChars.join("");
  const canonicalDomain = `${canonicalLabel}.${tld}`;

  // Compute similarity: average of substitution stableDanger scores
  let similarity = 0;
  if (substitutions.length > 0) {
    const total = substitutions.reduce((sum, s) => sum + s.stableDanger, 0);
    similarity = total / substitutions.length;
  }

  const impersonates =
    substitutions.length > 0
      ? [{ domain: canonicalDomain, similarity, substitutions }]
      : [];

  return {
    domain,
    punycode,
    impersonates,
  };
}
