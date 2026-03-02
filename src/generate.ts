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
  /** True if this is a full single-script replacement of the entire label. */
  fullReplacement?: boolean;
};

/**
 * Generate confusable domain variants via k-edit enumeration.
 *
 * Algorithm:
 * 1. Split label from TLD at last dot. Only mutate the label.
 * 2. Build reverse lookup (prototype -> substitutes) once.
 * 3. In realistic mode (default): generate full single-script replacement
 *    variants for scripts that can cover every character in the label,
 *    plus same-script k-edit variants.
 * 4. In all mode: original behavior with no script filtering.
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
  const scriptMode = options?.scriptMode ?? "realistic";

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

  if (scriptMode === "realistic") {
    // --- Realistic mode: IDN-aware generation ---

    // Phase 1: Full single-script replacement variants.
    // For each target script, check if every character in the label has a
    // confusable in that script. If so, generate the full-replacement variant.
    const allScripts = new Set<string>();
    for (const ch of chars) {
      const subs = protoBuckets[ch];
      if (subs) {
        for (const sub of subs) {
          if (sub.crossScript) allScripts.add(sub.script);
        }
      }
    }

    for (const targetScript of allScripts) {
      const coverage: ConfusableSubstitute[] = [];
      let complete = true;

      for (let i = 0; i < chars.length; i++) {
        const subs = protoBuckets[chars[i]];
        // Find best substitute in this target script
        const sub = subs?.find((s) => s.script === targetScript);
        if (!sub) {
          complete = false;
          break;
        }
        coverage.push(sub);
      }

      if (complete) {
        const mutated = coverage.map((s) => s.char);
        const substitutions = coverage.map((s, i) =>
          makeSubstitution(i, chars[i], s)
        );
        const mutatedStr = mutated.join("");
        if (variants.length >= maxVariants) return finalize(variants, scoreKey);
        if (!seen.has(mutatedStr)) {
          seen.add(mutatedStr);
          variants.push({
            label: mutatedStr,
            substitutions,
            fullReplacement: true,
          });
        }
      }
    }

    // Phase 2: Same-script k-edit variants.
    // Only allow substitutes from the same script as the original character.

    // 1-edit pass (same-script only)
    for (let i = 0; i < chars.length; i++) {
      const proto = chars[i];
      const subs = protoBuckets[proto];
      if (!subs) continue;

      const sameScriptSubs = subs
        .filter((s) => !s.crossScript)
        .slice(0, maxPerChar);
      for (const sub of sameScriptSubs) {
        const mutated = [...chars];
        mutated[i] = sub.char;
        const substitution = makeSubstitution(i, proto, sub);
        if (!tryAdd(mutated, [substitution]))
          return finalize(variants, scoreKey);
      }
    }

    // 2-edit pass (same-script only)
    if (maxEdits >= 2) {
      for (let i = 0; i < chars.length - 1; i++) {
        const subsI = protoBuckets[chars[i]];
        if (!subsI) continue;
        const sameI = subsI
          .filter((s) => !s.crossScript)
          .slice(0, Math.min(maxPerChar, 5));
        if (sameI.length === 0) continue;

        for (let j = i + 1; j < chars.length; j++) {
          const subsJ = protoBuckets[chars[j]];
          if (!subsJ) continue;
          const sameJ = subsJ
            .filter((s) => !s.crossScript)
            .slice(0, Math.min(maxPerChar, 5));

          for (const subI of sameI) {
            for (const subJ of sameJ) {
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
  } else {
    // --- All mode: original behavior, no script filtering ---

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
        if (!tryAdd(mutated, [substitution]))
          return finalize(variants, scoreKey);
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
    const scoreA = aggregateScore(a, scoreKey);
    const scoreB = aggregateScore(b, scoreKey);
    return scoreB - scoreA;
  });
  return variants;
}

/** Compute aggregate danger for sorting during generation. */
function aggregateScore(
  variant: RawVariant,
  scoreKey: "danger" | "stableDanger"
): number {
  const subs = variant.substitutions;
  if (subs.length === 0) return 0;
  let product = 1;
  for (const s of subs) {
    product *= s[scoreKey];
  }
  // Full single-script replacements skip the multi-edit penalty
  if (variant.fullReplacement) return product;
  // Penalize multi-edit slightly
  return product * (1 - 0.1 * (subs.length - 1));
}
