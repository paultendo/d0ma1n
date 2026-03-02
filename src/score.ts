import { CONFUSABLE_WEIGHTS } from "namespace-guard/confusable-weights";
import { FONT_SPECIFIC_WEIGHTS } from "namespace-guard/font-specific-weights";
import type { ConfusableWeights } from "namespace-guard";
import type { RawVariant } from "./generate.js";
import type { DomainVariant, Substitution, ScoreOptions } from "./types.js";
import { getScript } from "./reverse-map.js";

/** Web-safe fonts that can be rendered via CSS font-family directly. */
const WEB_SAFE_FONTS = new Set([
  "Arial",
  "Verdana",
  "Georgia",
  "Courier New",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Helvetica",
  "Impact",
  "Lucida Console",
  "Palatino Linotype",
]);

/**
 * Compute the composite danger score for a variant.
 *
 * Formula: product(stableDanger_i) * (1 - 0.1 * (editCount - 1))
 * Full single-script replacements skip the multi-edit penalty (they are the
 * most dangerous attack vector: the entire label is a single non-Latin script).
 * Mixed-script penalty: -0.1 (browsers show punycode for mixed scripts)
 */
export function computeDangerScore(
  substitutions: Substitution[],
  options?: ScoreOptions & { fullReplacement?: boolean }
): number {
  if (substitutions.length === 0) return 0;

  const useMax = options?.useMaxDanger ?? false;
  const scoreKey = useMax ? "danger" : "stableDanger";

  let product = 1;
  for (const sub of substitutions) {
    product *= sub[scoreKey];
  }

  // Full single-script replacements skip the multi-edit penalty.
  // The entire label is replaced with a single script, making it
  // the most deceptive variant (browsers display it as Unicode).
  let score: number;
  if (options?.fullReplacement) {
    score = product;
  } else {
    const editPenalty = 1 - 0.1 * (substitutions.length - 1);
    score = product * editPenalty;
  }

  // Mixed-script penalty: if substitutions use different scripts, penalty
  const scripts = new Set(substitutions.map((s) => s.script));
  if (scripts.size > 1) {
    score *= 0.9;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Find the font where this variant's substitution scores highest.
 * Returns the best font name and its score, or undefined if no
 * font-specific data is available.
 */
export function findBestFont(
  substitutions: Substitution[]
): { font: string; score: number } | undefined {
  const fontWeights = FONT_SPECIFIC_WEIGHTS as Record<string, ConfusableWeights>;
  let bestFont: string | undefined;
  let bestScore = 0;

  for (const [fontName, weights] of Object.entries(fontWeights)) {
    let fontProduct = 1;
    let allFound = true;

    for (const sub of substitutions) {
      // Bidirectional lookup in font-specific weights
      const w =
        weights[sub.replacement]?.[sub.original] ??
        weights[sub.original]?.[sub.replacement] ??
        weights[sub.replacement]?.[sub.original.toUpperCase()] ??
        weights[sub.original.toUpperCase()]?.[sub.replacement];

      if (w) {
        fontProduct *= w.danger;
      } else {
        allFound = false;
        break;
      }
    }

    if (allFound && fontProduct > bestScore) {
      bestScore = fontProduct;
      bestFont = fontName;
    }
  }

  if (bestFont) {
    return { font: bestFont, score: bestScore };
  }
  return undefined;
}

/**
 * Convert a Unicode domain label to punycode (ACE form).
 * Uses the built-in URL API for encoding.
 */
export function toPunycode(domain: string): string {
  try {
    // URL API handles IDN encoding
    const url = new URL(`http://${domain}`);
    return url.hostname;
  } catch {
    return domain;
  }
}

/**
 * Score raw variants and produce full DomainVariant records.
 */
export function scoreVariants(
  rawVariants: RawVariant[],
  tld: string,
  options?: ScoreOptions
): DomainVariant[] {
  return rawVariants.map((raw) => {
    const domain = `${raw.label}.${tld}`;
    const dangerScore = computeDangerScore(raw.substitutions, {
      ...options,
      fullReplacement: raw.fullReplacement,
    });

    // Find best font for display
    let bestFont: string | undefined;
    let bestFontScore: number | undefined;

    if (options?.font) {
      // Use specific font if requested
      const fontWeights = (FONT_SPECIFIC_WEIGHTS as Record<string, ConfusableWeights>)[options.font];
      if (fontWeights) {
        let product = 1;
        let allFound = true;
        for (const sub of raw.substitutions) {
          const w =
            fontWeights[sub.replacement]?.[sub.original] ??
            fontWeights[sub.original]?.[sub.replacement];
          if (w) {
            product *= w.danger;
          } else {
            allFound = false;
            break;
          }
        }
        if (allFound) {
          bestFont = options.font;
          bestFontScore = product;
        }
      }
    } else {
      // Auto-detect best font
      const best = findBestFont(raw.substitutions);
      if (best) {
        bestFont = best.font;
        bestFontScore = best.score;
      }
    }

    return {
      domain,
      dangerScore,
      editCount: raw.substitutions.length,
      substitutions: raw.substitutions,
      ...(raw.fullReplacement ? { fullReplacement: true } : {}),
      bestFont,
      bestFontScore,
      punycode: toPunycode(domain),
    };
  });
}
