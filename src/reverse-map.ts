import { CONFUSABLE_MAP_FULL } from "namespace-guard";
import { CONFUSABLE_WEIGHTS } from "namespace-guard/confusable-weights";
import type { ConfusableWeights } from "namespace-guard";
import type { ConfusableSubstitute, PrototypeBuckets } from "./types.js";

/** Unicode script detectors, ordered by frequency in spoofing attacks. */
const SCRIPT_DETECTORS: [string, RegExp][] = [
  ["Latin", /\p{Script=Latin}/u],
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Armenian", /\p{Script=Armenian}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
  ["Han", /\p{Script=Han}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Georgian", /\p{Script=Georgian}/u],
  ["Thai", /\p{Script=Thai}/u],
];

/** Detect the Unicode script of a character. */
export function getScript(ch: string): string {
  for (const [name, re] of SCRIPT_DETECTORS) {
    if (re.test(ch)) return name;
  }
  return "Common";
}

/** Format a codepoint as "U+XXXX". */
export function toCodepoint(ch: string): string {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return "U+0000";
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Build bidirectional confusable buckets.
 *
 * For every edge (A, B) in the confusable data, BOTH characters get a bucket:
 *   - bucket[A] includes B
 *   - bucket[B] includes A
 *
 * This means:
 *   - Latin "a" has a bucket containing Cyrillic "а", Greek "α", etc.
 *   - Cyrillic "а" has a bucket containing Latin "a", Greek "α", etc.
 *   - Thai "๐" has a bucket containing Devanagari "०", etc.
 *
 * Every character that appears in CONFUSABLE_WEIGHTS or CONFUSABLE_MAP_FULL
 * can be a starting point for variant generation, regardless of script.
 *
 * Sources:
 * 1. CONFUSABLE_MAP_FULL: TR39 confusable mappings (char -> prototype)
 * 2. CONFUSABLE_WEIGHTS: 1,397 SSIM-scored pairs including 317 cross-script
 *    non-ASCII pairs (Hangul/Han, Cyrillic/Greek, Thai/Devanagari, etc.)
 */
export function buildPrototypeBuckets(options?: {
  includeNonPvalid?: boolean;
  maxPerChar?: number;
  useMaxDanger?: boolean;
}): PrototypeBuckets {
  const includeNonPvalid = options?.includeNonPvalid ?? false;
  const maxPerChar = options?.maxPerChar ?? 50;
  const useMaxDanger = options?.useMaxDanger ?? false;

  const raw: Record<string, Map<string, ConfusableSubstitute>> = {};

  const ensureBucket = (proto: string) => {
    if (!raw[proto]) raw[proto] = new Map();
  };

  /** Add a confusable edge: character `from` can be spoofed by character `sub`. */
  const addEdge = (
    from: string,
    sub: string,
    danger: number,
    stableDanger: number,
    idnaPvalid: boolean
  ) => {
    if (from === sub) return;
    if (!includeNonPvalid && !idnaPvalid) return;

    ensureBucket(from);
    const existing = raw[from].get(sub);
    if (existing) {
      // Keep the higher score
      if (stableDanger > existing.stableDanger) {
        existing.danger = danger;
        existing.stableDanger = stableDanger;
        existing.idnaPvalid = existing.idnaPvalid || idnaPvalid;
      }
      return;
    }

    raw[from].set(sub, {
      char: sub,
      codepoint: toCodepoint(sub),
      script: getScript(sub),
      danger,
      stableDanger,
      idnaPvalid,
    });
  };

  // 1. CONFUSABLE_MAP_FULL: TR39 mappings (confusable -> prototype)
  //    Add bidirectionally: prototype gets the confusable, confusable gets the prototype.
  for (const [char, prototype] of Object.entries(CONFUSABLE_MAP_FULL)) {
    if (char === prototype) continue;

    // Look up SSIM weight if available (bidirectional lookup, matching lookupWeight pattern)
    const weights = CONFUSABLE_WEIGHTS as ConfusableWeights;
    const w =
      weights[char]?.[prototype] ??
      weights[prototype]?.[char] ??
      weights[char]?.[prototype.toUpperCase()] ??
      weights[prototype.toUpperCase()]?.[char];

    const danger = w?.danger ?? 0.5;
    const stableDanger = w?.stableDanger ?? 0.5;
    const idnaPvalid = w?.idnaPvalid ?? false;

    // Forward: prototype -> confusable char (e.g. "a" -> Cyrillic "а")
    addEdge(prototype, char, danger, stableDanger, idnaPvalid);
    // Reverse: confusable char -> prototype (e.g. Cyrillic "а" -> "a")
    addEdge(char, prototype, danger, stableDanger, idnaPvalid);
  }

  // 2. CONFUSABLE_WEIGHTS: all SSIM-scored pairs, including cross-script.
  //    Every edge is bidirectional. This captures:
  //    - ASCII <-> non-ASCII (Latin a <-> Cyrillic а)
  //    - Non-ASCII <-> non-ASCII (Hangul ᅵ <-> Han 丨, Greek α <-> Cyrillic а)
  for (const [keyA, targets] of Object.entries(
    CONFUSABLE_WEIGHTS as ConfusableWeights
  )) {
    for (const [keyB, weight] of Object.entries(targets)) {
      const aLower = keyA.toLowerCase();
      const bLower = keyB.toLowerCase();

      // A -> B: "aLower" can be spoofed by "keyB"
      addEdge(aLower, keyB, weight.danger, weight.stableDanger, weight.idnaPvalid ?? false);
      // B -> A: "bLower" can be spoofed by "keyA"
      addEdge(bLower, keyA, weight.danger, weight.stableDanger, weight.idnaPvalid ?? false);
    }
  }

  // 3. Sort by danger descending and cap
  const buckets: PrototypeBuckets = {};
  const scoreKey = useMaxDanger ? "danger" : "stableDanger";

  for (const [proto, map] of Object.entries(raw)) {
    const subs = Array.from(map.values());
    subs.sort((a, b) => b[scoreKey] - a[scoreKey]);
    buckets[proto] = subs.slice(0, maxPerChar);
  }

  return buckets;
}

/** Cached default buckets (PVALID-only, p95 scoring). */
let cachedBuckets: PrototypeBuckets | null = null;

/** Get or build the default prototype buckets (cached). */
export function getDefaultBuckets(): PrototypeBuckets {
  if (!cachedBuckets) {
    cachedBuckets = buildPrototypeBuckets();
  }
  return cachedBuckets;
}
