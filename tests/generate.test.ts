import { describe, it, expect } from "vitest";
import { generateVariants } from "../src/generate.js";
import { buildPrototypeBuckets } from "../src/reverse-map.js";

describe("generateVariants", () => {
  // Build buckets once for all tests
  const buckets = buildPrototypeBuckets();

  it("generates variants for a simple label", () => {
    const variants = generateVariants("paypal", undefined, buckets);
    expect(variants.length).toBeGreaterThan(0);
  });

  it("produces variants with valid substitutions", () => {
    const variants = generateVariants("paypal", { maxEdits: 1 }, buckets);

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
      { maxEdits: 1, maxPerChar: 3 },
      buckets
    );

    for (const v of variants) {
      const original = [...("test")];
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
      { maxEdits: 2, maxPerChar: 3 },
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
    const variants = generateVariants("aa", undefined, buckets);
    const labels = variants.map((v) => v.label);
    const unique = new Set(labels);
    expect(labels.length).toBe(unique.size);
  });

  it("respects maxVariants cap", () => {
    const variants = generateVariants(
      "paypal",
      { maxVariants: 10 },
      buckets
    );
    expect(variants.length).toBeLessThanOrEqual(10);
  });

  it("sorts variants by danger descending", () => {
    const variants = generateVariants(
      "paypal",
      { maxEdits: 1 },
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
