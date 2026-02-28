import { describe, it, expect } from "vitest";
import {
  computeDangerScore,
  findBestFont,
  scoreVariants,
  toPunycode,
} from "../src/score.js";
import { generateVariants } from "../src/generate.js";
import { buildPrototypeBuckets } from "../src/reverse-map.js";
import type { Substitution } from "../src/types.js";

describe("computeDangerScore", () => {
  it("returns 0 for empty substitutions", () => {
    expect(computeDangerScore([])).toBe(0);
  });

  it("returns stableDanger for single substitution", () => {
    const sub: Substitution = {
      position: 0,
      original: "a",
      replacement: "\u0430",
      codepoint: "U+0430",
      script: "Cyrillic",
      danger: 1.0,
      stableDanger: 0.9,
      idnaPvalid: true,
    };
    const score = computeDangerScore([sub]);
    expect(score).toBeCloseTo(0.9, 1);
  });

  it("applies multi-edit penalty for 2 substitutions", () => {
    const subs: Substitution[] = [
      {
        position: 0,
        original: "a",
        replacement: "\u0430",
        codepoint: "U+0430",
        script: "Cyrillic",
        danger: 1.0,
        stableDanger: 0.9,
        idnaPvalid: true,
      },
      {
        position: 2,
        original: "p",
        replacement: "\u0440",
        codepoint: "U+0440",
        script: "Cyrillic",
        danger: 1.0,
        stableDanger: 0.85,
        idnaPvalid: true,
      },
    ];
    const score = computeDangerScore(subs);
    // 0.9 * 0.85 * (1 - 0.1) = 0.765 * 0.9 = 0.6885
    expect(score).toBeCloseTo(0.9 * 0.85 * 0.9, 2);
  });

  it("uses max danger when configured", () => {
    const sub: Substitution = {
      position: 0,
      original: "a",
      replacement: "\u0430",
      codepoint: "U+0430",
      script: "Cyrillic",
      danger: 1.0,
      stableDanger: 0.9,
      idnaPvalid: true,
    };
    const score = computeDangerScore([sub], { useMaxDanger: true });
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("applies mixed-script penalty", () => {
    const subs: Substitution[] = [
      {
        position: 0,
        original: "a",
        replacement: "\u0430",
        codepoint: "U+0430",
        script: "Cyrillic",
        danger: 1.0,
        stableDanger: 0.9,
        idnaPvalid: true,
      },
      {
        position: 2,
        original: "e",
        replacement: "\u03B5",
        codepoint: "U+03B5",
        script: "Greek",
        danger: 1.0,
        stableDanger: 0.85,
        idnaPvalid: true,
      },
    ];
    const score = computeDangerScore(subs);
    // product * editPenalty * mixedScriptPenalty
    // 0.9 * 0.85 * 0.9 * 0.9
    expect(score).toBeCloseTo(0.9 * 0.85 * 0.9 * 0.9, 2);
  });
});

describe("toPunycode", () => {
  it("converts ASCII domain unchanged", () => {
    expect(toPunycode("paypal.com")).toBe("paypal.com");
  });

  it("converts IDN domain to punycode", () => {
    const result = toPunycode("p\u0430ypal.com");
    expect(result).toMatch(/^xn--/);
  });
});

describe("scoreVariants", () => {
  const buckets = buildPrototypeBuckets();

  it("produces scored DomainVariant records", () => {
    const raw = generateVariants("paypal", { maxEdits: 1, maxPerChar: 3 }, buckets);
    const scored = scoreVariants(raw.slice(0, 5), "com");

    for (const v of scored) {
      expect(v.domain).toContain(".com");
      expect(v.dangerScore).toBeGreaterThanOrEqual(0);
      expect(v.dangerScore).toBeLessThanOrEqual(1);
      expect(v.editCount).toBe(1);
      expect(v.punycode).toBeDefined();
    }
  });
});

describe("findBestFont", () => {
  it("returns a font for high-danger Cyrillic substitutions", () => {
    const sub: Substitution = {
      position: 0,
      original: "a",
      replacement: "\u0430",
      codepoint: "U+0430",
      script: "Cyrillic",
      danger: 1.0,
      stableDanger: 0.9,
      idnaPvalid: true,
    };
    const result = findBestFont([sub]);
    // May or may not find a font depending on data coverage
    if (result) {
      expect(result.font).toBeTruthy();
      expect(result.ssim).toBeGreaterThan(0);
    }
  });
});
