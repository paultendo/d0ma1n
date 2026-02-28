import { buildPrototypeBuckets } from "./reverse-map.js";
import type {
  GenerateOptions,
  PrototypeBuckets,
  Substitution,
  ConfusableSubstitute,
} from "./types.js";

/** A raw generated variant before scoring and DNS resolution. */
export type RawVariant = {
  /** The mutated label (without TLD). */
  label: string;
  /** Substitutions applied. */
  substitutions: Substitution[];
};

/**
 * Generate confusable domain variants via k-edit enumeration.
 *
 * Algorithm:
 * 1. Split label from TLD at last dot. Only mutate the label.
 * 2. Build reverse lookup (prototype -> substitutes) once.
 * 3. 1-edit pass: each position x each substitute (top maxPerChar).
 * 4. 2-edit pass: each pair of positions (i < j), cross their substitutes.
 * 5. Hard cap at maxVariants, most dangerous first.
 * 6. Deduplicate via Set.
 */
export function generateVariants(
  label: string,
  options?: GenerateOptions,
  buckets?: PrototypeBuckets
): RawVariant[] {
  const maxEdits = options?.maxEdits ?? 2;
  const maxPerChar = options?.maxPerChar ?? 10;
  const maxVariants = options?.maxVariants ?? 5000;
  const useMaxDanger = options?.useMaxDanger ?? false;

  // Build or reuse buckets
  const protoBuckets =
    buckets ??
    buildPrototypeBuckets({
      includeNonPvalid: options?.includeNonPvalid,
      maxPerChar,
      useMaxDanger,
    });

  const chars = [...label.toLowerCase()];
  const seen = new Set<string>();
  const variants: RawVariant[] = [];

  const scoreKey = useMaxDanger ? "danger" : "stableDanger";

  /** Try to add a variant; returns false if cap reached. */
  const tryAdd = (mutatedChars: string[], subs: Substitution[]): boolean => {
    if (variants.length >= maxVariants) return false;
    const mutated = mutatedChars.join("");
    if (seen.has(mutated)) return true; // skip duplicate, keep going
    seen.add(mutated);
    variants.push({ label: mutated, substitutions: subs });
    return true;
  };

  // 1-edit pass
  for (let i = 0; i < chars.length; i++) {
    const proto = chars[i];
    const subs = protoBuckets[proto];
    if (!subs) continue;

    const topSubs = subs.slice(0, maxPerChar);
    for (const sub of topSubs) {
      const mutated = [...chars];
      mutated[i] = sub.char;
      const substitution = makeSubstitution(i, proto, sub);
      if (!tryAdd(mutated, [substitution])) return finalize(variants, scoreKey);
    }
  }

  // 2-edit pass (if allowed)
  if (maxEdits >= 2) {
    for (let i = 0; i < chars.length - 1; i++) {
      const subsI = protoBuckets[chars[i]];
      if (!subsI) continue;

      for (let j = i + 1; j < chars.length; j++) {
        const subsJ = protoBuckets[chars[j]];
        if (!subsJ) continue;

        // Cross the top substitutes for positions i and j
        const topI = subsI.slice(0, Math.min(maxPerChar, 5));
        const topJ = subsJ.slice(0, Math.min(maxPerChar, 5));

        for (const subI of topI) {
          for (const subJ of topJ) {
            const mutated = [...chars];
            mutated[i] = subI.char;
            mutated[j] = subJ.char;
            const substitutions = [
              makeSubstitution(i, chars[i], subI),
              makeSubstitution(j, chars[j], subJ),
            ];
            if (!tryAdd(mutated, substitutions))
              return finalize(variants, scoreKey);
          }
        }
      }
    }
  }

  return finalize(variants, scoreKey);
}

/** Create a Substitution record from a ConfusableSubstitute. */
function makeSubstitution(
  position: number,
  original: string,
  sub: ConfusableSubstitute
): Substitution {
  return {
    position,
    original,
    replacement: sub.char,
    codepoint: sub.codepoint,
    script: sub.script,
    danger: sub.danger,
    stableDanger: sub.stableDanger,
    idnaPvalid: sub.idnaPvalid,
  };
}

/** Sort variants by aggregate danger (most dangerous first). */
function finalize(
  variants: RawVariant[],
  scoreKey: "danger" | "stableDanger"
): RawVariant[] {
  variants.sort((a, b) => {
    const scoreA = aggregateScore(a.substitutions, scoreKey);
    const scoreB = aggregateScore(b.substitutions, scoreKey);
    return scoreB - scoreA;
  });
  return variants;
}

/** Compute aggregate danger for sorting during generation. */
function aggregateScore(
  subs: Substitution[],
  scoreKey: "danger" | "stableDanger"
): number {
  if (subs.length === 0) return 0;
  let product = 1;
  for (const s of subs) {
    product *= s[scoreKey];
  }
  // Penalize multi-edit slightly
  return product * (1 - 0.1 * (subs.length - 1));
}
