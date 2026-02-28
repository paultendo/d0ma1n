import { describe, it, expect } from "vitest";
import {
  buildPrototypeBuckets,
  getScript,
  toCodepoint,
} from "../src/reverse-map.js";

describe("getScript", () => {
  it("detects Latin", () => {
    expect(getScript("a")).toBe("Latin");
  });

  it("detects Cyrillic", () => {
    expect(getScript("\u0430")).toBe("Cyrillic"); // Cyrillic small a
  });

  it("detects Greek", () => {
    expect(getScript("\u03B1")).toBe("Greek"); // Greek small alpha
  });

  it("returns Common for digits", () => {
    expect(getScript("0")).toBe("Common");
  });
});

describe("toCodepoint", () => {
  it("formats ASCII", () => {
    expect(toCodepoint("a")).toBe("U+0061");
  });

  it("formats Cyrillic a", () => {
    expect(toCodepoint("\u0430")).toBe("U+0430");
  });
});

describe("buildPrototypeBuckets", () => {
  it("returns buckets for common ASCII prototypes", () => {
    const buckets = buildPrototypeBuckets();

    // Should have entries for common letters targeted by confusables
    expect(Object.keys(buckets).length).toBeGreaterThan(0);

    // 'a' should have Cyrillic substitutes at minimum
    expect(buckets["a"]).toBeDefined();
    expect(buckets["a"].length).toBeGreaterThan(0);
  });

  it("sorts substitutes by stableDanger descending", () => {
    const buckets = buildPrototypeBuckets();

    for (const subs of Object.values(buckets)) {
      for (let i = 1; i < subs.length; i++) {
        expect(subs[i - 1].stableDanger).toBeGreaterThanOrEqual(
          subs[i].stableDanger
        );
      }
    }
  });

  it("filters non-PVALID chars by default", () => {
    const buckets = buildPrototypeBuckets();

    for (const subs of Object.values(buckets)) {
      for (const sub of subs) {
        expect(sub.idnaPvalid).toBe(true);
      }
    }
  });

  it("includes non-PVALID chars when requested", () => {
    const filtered = buildPrototypeBuckets({ includeNonPvalid: false });
    const unfiltered = buildPrototypeBuckets({ includeNonPvalid: true });

    // Unfiltered should have at least as many entries
    let filteredTotal = 0;
    let unfilteredTotal = 0;
    for (const subs of Object.values(filtered)) filteredTotal += subs.length;
    for (const subs of Object.values(unfiltered))
      unfilteredTotal += subs.length;

    expect(unfilteredTotal).toBeGreaterThanOrEqual(filteredTotal);
  });

  it("respects maxPerChar", () => {
    const buckets = buildPrototypeBuckets({ maxPerChar: 3 });

    for (const subs of Object.values(buckets)) {
      expect(subs.length).toBeLessThanOrEqual(3);
    }
  });

  it("assigns correct script names", () => {
    const buckets = buildPrototypeBuckets();

    // At least some entries should be non-Latin
    const scripts = new Set<string>();
    for (const subs of Object.values(buckets)) {
      for (const sub of subs) {
        scripts.add(sub.script);
      }
    }

    expect(scripts.has("Cyrillic")).toBe(true);
  });
});
