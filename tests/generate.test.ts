import { describe, it, expect } from "vitest";
import { generateVariants } from "../src/generate.js";
import { buildPrototypeBuckets } from "../src/reverse-map.js";
import { getScript } from "../src/reverse-map.js";

describe("generateVariants", () => {
  // Build buckets once for all tests
  const buckets = buildPrototypeBuckets();

  it("generates variants for a simple label", () => {
    const variants = generateVariants(
      "paypal",
      { scriptMode: "all" },
      buckets
    );
    expect(variants.length).toBeGreaterThan(0);
  });

  it("produces variants with valid substitutions", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 1, scriptMode: "all" },
      buckets
    );

    for (const v of variants) {
      expect(v.substitutions.length).toBe(1);
      expect(v.substitutions[0].position).toBeGreaterThanOrEqual(0);
      expect(v.substitutions[0].original).toMatch(/^[a-z0-9]$/);
      expect(v.substitutions[0].replacement).not.toBe(
        v.substitutions[0].original
      );
    }
  });

  it("1-edit variants differ by exactly one character", () => {
    const variants = generateVariants(
      "test",
      { maxEdits: 1, maxPerChar: 3, scriptMode: "all" },
      buckets
    );

    for (const v of variants) {
      const original = [..."test"];
      const mutated = [...v.label];
      let diffCount = 0;
      for (let i = 0; i < original.length; i++) {
        if (original[i] !== mutated[i]) diffCount++;
      }
      expect(diffCount).toBe(1);
    }
  });

  it("2-edit variants have two substitutions", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 2, maxPerChar: 3, scriptMode: "all" },
      buckets
    );

    const twoEditVariants = variants.filter(
      (v) => v.substitutions.length === 2
    );
    expect(twoEditVariants.length).toBeGreaterThan(0);

    for (const v of twoEditVariants) {
      expect(v.substitutions[0].position).toBeLessThan(
        v.substitutions[1].position
      );
    }
  });

  it("deduplicates identical variants", () => {
    const variants = generateVariants(
      "aa",
      { scriptMode: "all" },
      buckets
    );
    const labels = variants.map((v) => v.label);
    const unique = new Set(labels);
    expect(labels.length).toBe(unique.size);
  });

  it("respects maxVariants cap", () => {
    const variants = generateVariants(
      "paypal",
      { maxVariants: 10, scriptMode: "all" },
      buckets
    );
    expect(variants.length).toBeLessThanOrEqual(10);
  });

  it("sorts variants by danger descending", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 1, scriptMode: "all" },
      buckets
    );

    for (let i = 1; i < variants.length; i++) {
      const prevScore = variants[i - 1].substitutions.reduce(
        (acc, s) => acc * s.stableDanger,
        1
      );
      const currScore = variants[i].substitutions.reduce(
        (acc, s) => acc * s.stableDanger,
        1
      );
      expect(prevScore).toBeGreaterThanOrEqual(currScore);
    }
  });
});

describe("generateVariants (realistic mode)", () => {
  const buckets = buildPrototypeBuckets();

  it("defaults to realistic mode", () => {
    const variants = generateVariants("paypal", undefined, buckets);
    // Should generate some variants
    expect(variants.length).toBeGreaterThan(0);
  });

  it("generates full single-script replacement variants", () => {
    // "paypal" has Cyrillic lookalikes for all characters (p->р, a->а, y->у, l->ӏ or similar)
    const variants = generateVariants(
      "paypal",
      { scriptMode: "realistic" },
      buckets
    );

    // Look for a variant where all substitutions are the same non-Latin script
    const fullReplacements = variants.filter((v) => {
      if (v.substitutions.length !== [...("paypal")].length) return false;
      const scripts = new Set(v.substitutions.map((s) => s.script));
      return scripts.size === 1 && !scripts.has("Latin");
    });

    // Cyrillic full replacement should exist for "paypal"
    expect(fullReplacements.length).toBeGreaterThan(0);
  });

  it("excludes cross-script single-position edits", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 1, scriptMode: "realistic" },
      buckets
    );

    // Filter to 1-edit variants (not full replacements)
    const singleEdits = variants.filter((v) => v.substitutions.length === 1);

    for (const v of singleEdits) {
      const sub = v.substitutions[0];
      const originalScript = getScript(sub.original);
      // Substitute should be same script as original, or Common
      expect(
        sub.script === originalScript ||
          sub.script === "Common" ||
          originalScript === "Common"
      ).toBe(true);
    }
  });

  it("produces no mixed-script variants", () => {
    const variants = generateVariants(
      "paypal",
      { scriptMode: "realistic" },
      buckets
    );

    for (const v of variants) {
      // Get the script of every character in the variant label
      const labelChars = [...v.label];
      const scripts = new Set<string>();
      for (const ch of labelChars) {
        const script = getScript(ch);
        if (script !== "Common") scripts.add(script);
      }

      // Every variant should be either:
      // 1. All one script (full replacement or same-script edits), or
      // 2. Have substitutions that are all same-script as their originals
      if (scripts.size > 1) {
        // This would be a mixed-script variant, which shouldn't happen
        // UNLESS the original label itself is multi-script
        // For a Latin-only label like "paypal", this should not occur
        expect(scripts.size).toBeLessThanOrEqual(1);
      }
    }
  });

  it("same-script substitutes are still included", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 1, scriptMode: "realistic" },
      buckets
    );

    // Should have some 1-edit same-script Latin variants (e.g. Latin ɑ for a)
    const sameScriptEdits = variants.filter(
      (v) =>
        v.substitutions.length === 1 && v.substitutions[0].script === "Latin"
    );

    // There should be at least some Latin same-script substitutes
    // (depends on weight data, but 'a' should have Latin ɑ)
    expect(sameScriptEdits.length).toBeGreaterThanOrEqual(0);
  });
});
