import { describe, expect, it } from "vitest";

import {
  createDomainPolicyEvaluator,
  evaluateDomainLabel,
  evaluateDomainSpoof,
  getDomainPolicyProfile,
  getDomainPolicyProfileForTld,
  listDomainPolicyProfiles,
} from "../src/policy/index.js";

describe("evaluateDomainLabel", () => {
  it("treats ASCII labels as low-risk", () => {
    const result = evaluateDomainLabel("paypal", {
      profile: getDomainPolicyProfile("verisign-com"),
    });

    expect(result.decision).toBe("allow");
    expect(result.displayMode).toBe("ascii");
    expect(result.registrable).toBe(true);
  });

  it("treats mixed-script labels as non-registrable under strict profiles", () => {
    const result = evaluateDomainLabel("pаypal", {
      profile: getDomainPolicyProfile("verisign-com"),
    });

    expect(result.registrable).toBe(false);
    expect(result.displayMode).toBe("punycode");
  });
});

describe("evaluateDomainSpoof", () => {
  it("flags a realistic whole-script spoof", () => {
    const result = evaluateDomainSpoof("раураӏ", "paypal", {
      profile: getDomainPolicyProfile("verisign-com"),
    });

    expect(result.spoof).toBe(true);
    expect(result.decision).toBe("block");
    expect(result.danger).toBeGreaterThan(0.5);
  });

  it("downgrades mixed-script noise even if visually confusing", () => {
    const result = evaluateDomainSpoof("pаypal", "paypal", {
      profile: getDomainPolicyProfile("verisign-com"),
    });

    expect(result.spoof).toBe(false);
    expect(result.registrable).toBe(false);
    expect(result.decision === "allow" || result.decision === "warn" || result.decision === "review").toBe(true);
  });

  it("uses observed substitutions to keep same-script measured confusables out of allow", () => {
    const result = evaluateDomainSpoof("paỵpal", "paypal", {
      profile: getDomainPolicyProfile("verisign-com"),
      observedSubstitutions: [
        {
          index: 2,
          from: "y",
          to: "ỵ",
          similarity: 1,
        },
      ],
    });

    expect(result.spoof).toBe(false);
    expect(result.substitutions.length).toBe(1);
    expect(result.danger).toBeGreaterThan(0.8);
    expect(result.decision).toBe("review");
  });

  it("reports how each surface shows a lookalike, from the recorded QR test", () => {
    const whole = evaluateDomainSpoof("раураӏ", "paypal", { profile: getDomainPolicyProfile("verisign-com") });
    expect(whole.surfaces).toEqual({ chromium: "punycode", firefox: "unicode", androidCamera: "unicode", iosCamera: "punycode" });
    const mixed = evaluateDomainSpoof("pаypal", "paypal", { profile: getDomainPolicyProfile("verisign-com") });
    expect(mixed.surfaces.chromium).toBe("punycode");
    expect(mixed.surfaces.androidCamera).toBe("unicode");
    const ascii = evaluateDomainSpoof("paypa1", "paypal", { profile: getDomainPolicyProfile("verisign-com") });
    expect(ascii.surfaces.androidCamera).toBe("ascii");
  });

  it("a registered mixed-script lookalike is a threat, not noise", () => {
    const profile = getDomainPolicyProfile("verisign-com");
    const unregistered = evaluateDomainSpoof("pаypal", "paypal", { profile });
    const registered = evaluateDomainSpoof("pаypal", "paypal", { profile, registered: true });
    expect(unregistered.registrable).toBe(false);
    expect(registered.registered).toBe(true);
    expect(registered.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["registered", "decoded-by-camera"]));
    expect(registered.reasons.map((r) => r.code)).not.toContain("not-registrable-under-profile");
    expect(registered.score).toBeGreaterThan(unregistered.score);
    expect(["review", "block"]).toContain(registered.decision);
  });

  it("allows Japanese mixed-script labels under the Japanese profile", () => {
    const result = evaluateDomainLabel("ロ口", {
      profile: getDomainPolicyProfile("japanese-idn"),
    });

    expect(result.registrable).toBe(true);
  });
});

describe("policy surface", () => {
  it("lists the available profiles", () => {
    expect(listDomainPolicyProfiles()).toEqual([
      "verisign-com",
      "verisign-net",
      "generic-idn-strict",
      "japanese-idn",
    ]);
  });

  it("creates a reusable evaluator bound to one profile", () => {
    const evaluator = createDomainPolicyEvaluator(getDomainPolicyProfile("verisign-com"));
    const label = evaluator.evaluateLabel("paypal");
    const spoof = evaluator.evaluateSpoof("раураӏ", "paypal");

    expect(evaluator.profile.name).toBe("verisign-com");
    expect(label.decision).toBe("allow");
    expect(spoof.spoof).toBe(true);
  });

  it("resolves policy profiles from TLDs", () => {
    expect(getDomainPolicyProfileForTld("com").name).toBe("verisign-com");
    expect(getDomainPolicyProfileForTld("net").name).toBe("verisign-net");
    expect(getDomainPolicyProfileForTld("co.jp").name).toBe("japanese-idn");
    expect(getDomainPolicyProfileForTld("org").name).toBe("generic-idn-strict");
  });
});
