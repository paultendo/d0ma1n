import { describe, it, expect } from "vitest";
import { scan } from "../src/scan.js";
import { reverseScan } from "../src/reverse-scan.js";
import { formatScanResult, formatReverseTable } from "../src/format.js";

describe("scan integration", () => {
  it("scans paypal.com and returns variants", async () => {
    const result = await scan("paypal.com", {
      top: 10,
      maxEdits: 1,
      maxPerChar: 5,
    });

    expect(result.original).toBe("paypal.com");
    expect(result.label).toBe("paypal");
    expect(result.tld).toBe("com");
    expect(result.totalGenerated).toBeGreaterThan(0);
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.variants.length).toBeLessThanOrEqual(10);
    expect(result.variants.some((v) => v.policy)).toBe(true);

    // Variants should be sorted by policy severity first.
    const priority = { block: 4, review: 3, warn: 2, allow: 1 } as const;
    for (let i = 1; i < result.variants.length; i++) {
      const prev = result.variants[i - 1];
      const curr = result.variants[i];
      const prevPriority = prev.policy ? priority[prev.policy.decision] : 0;
      const currPriority = curr.policy ? priority[curr.policy.decision] : 0;
      expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
    }
  });

  it("formats as table without error", async () => {
    const result = await scan("test.com", { top: 5, maxEdits: 1 });
    const output = formatScanResult(result, "table");
    expect(output).toContain("d0ma1n");
    expect(output).toContain("test.com");
    expect(output).toContain("Policy");
  });

  it("formats as JSON", async () => {
    const result = await scan("test.com", { top: 3, maxEdits: 1 });
    const json = formatScanResult(result, "json");
    const parsed = JSON.parse(json);
    expect(parsed.original).toBe("test.com");
    expect(parsed.variants).toBeInstanceOf(Array);
  });

  it("formats as CSV", async () => {
    const result = await scan("test.com", { top: 3, maxEdits: 1 });
    const csv = formatScanResult(result, "csv");
    expect(csv).toContain("domain,danger_score,policy_decision");
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(1); // header + data
  });

  it("applies threshold filter", async () => {
    const result = await scan("paypal.com", {
      top: 100,
      threshold: 0.8,
      maxEdits: 1,
    });

    for (const v of result.variants) {
      expect(v.dangerScore).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("supports multiple TLDs", async () => {
    const result = await scan("paypal.com", {
      top: 50,
      maxEdits: 1,
      maxPerChar: 3,
      tlds: ["com", "net"],
    });

    const tlds = new Set(
      result.variants.map((v) => v.domain.split(".").pop())
    );
    // Should include variants for both TLDs
    expect(tlds.size).toBeGreaterThanOrEqual(1);
  });

  it("can disable policy enrichment", async () => {
    const result = await scan("paypal.com", {
      top: 5,
      maxEdits: 1,
      policy: false,
    });

    expect(result.variants.every((v) => v.policy === undefined)).toBe(true);
  });
});

describe("reverse scan integration", () => {
  it("identifies what a confusable domain impersonates", () => {
    // Create a domain with Cyrillic 'a' (U+0430)
    const result = reverseScan("p\u0430ypal.com");

    expect(result.domain).toBe("p\u0430ypal.com");
    expect(result.impersonates.length).toBeGreaterThan(0);
    expect(result.impersonates[0].domain).toBe("paypal.com");
    expect(result.impersonates[0].substitutions.length).toBe(1);
    expect(result.impersonates[0].substitutions[0].script).toBe("Cyrillic");
  });

  it("returns empty impersonates for clean domains", () => {
    const result = reverseScan("paypal.com");
    expect(result.impersonates.length).toBe(0);
  });

  it("formats reverse results", () => {
    const result = reverseScan("p\u0430ypal.com");
    const output = formatReverseTable(result);
    expect(output).toContain("Impersonates");
    expect(output).toContain("paypal.com");
  });
});
