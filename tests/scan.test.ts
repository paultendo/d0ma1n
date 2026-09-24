import { describe, expect, it } from "vitest";

import { scan } from "../src/scan.js";
import { getScript } from "../src/reverse-map.js";
import type { DnsResult } from "../src/types.js";

const unregistered: DnsResult = { registered: false, a: [], aaaa: [], mx: [], ns: [], hasMx: false, threatLevel: "unregistered" };
const active: DnsResult = {
  registered: true, a: ["192.0.2.1"], aaaa: [], mx: [{ priority: 10, exchange: "mail.example.net" }], ns: [],
  hasMx: true, threatLevel: "active",
};

// A resolver that knows only the domains it is given; nothing touches the network.
function stubResolver(registered: string[]) {
  const asked: string[] = [];
  return {
    asked,
    resolve: async (domain: string) => {
      asked.push(domain);
      return registered.includes(domain) ? active : unregistered;
    },
  };
}

describe("mixed-script probes when resolving", () => {
  it("finds a registered mixed-script lookalike the default generation leaves out, and judges it as registered", async () => {
    const mixed = "pаypal.com"; // Cyrillic а among Latin letters
    const resolver = stubResolver([mixed]);
    const result = await scan("paypal.com", { resolve: true, resolver, tlds: ["com"], top: 20 });

    const found = result.variants.find((v) => v.domain === mixed);
    expect(found, "the registered mixed-script variant is reported").toBeDefined();
    expect(found!.probe).toBe(true);
    expect(found!.dns?.registered).toBe(true);
    expect(found!.policy?.registered).toBe(true);
    expect(found!.policy?.surfaces.chromium).toBe("punycode");
    expect(found!.policy?.surfaces.androidCamera).toBe("unicode");
    expect(found!.policy?.reasons.map((r) => r.code)).toContain("registered");
    expect(["review", "block"]).toContain(found!.policy?.decision);
    expect(result.variants[0].dns?.registered, "registered variants come first").toBe(true);
  });

  it("does not report mixed-script probes nobody has registered", async () => {
    const resolver = stubResolver([]);
    const result = await scan("paypal.com", { resolve: true, resolver, tlds: ["com"], top: 20 });
    expect(result.variants.some((v) => v.probe)).toBe(false);
    expect(resolver.asked.length).toBeGreaterThan(20); // the probes were resolved as well as the top variants
  });

  it("can be switched off, and never probes without resolving", async () => {
    const resolver = stubResolver(["pаypal.com"]);
    const off = await scan("paypal.com", { resolve: true, resolver, tlds: ["com"], top: 20, probeMixedScript: false });
    expect(off.variants.some((v) => v.domain === "pаypal.com")).toBe(false);
    const offline = await scan("paypal.com", { tlds: ["com"], top: 20 });
    expect(offline.variants.some((v) => v.probe)).toBe(false);
  });
});

describe("realistic generation", () => {
  it("keeps whole-label replacements within one script, and never offers a label IDNA would change", async () => {
    const result = await scan("scope.com", { tlds: ["com"], top: 200 });
    const scriptsOf = (label: string) => new Set([...label].map((ch) => getScript(ch)).filter((s) => s !== "Common"));
    for (const v of result.variants.filter((v) => v.fullReplacement)) {
      expect(scriptsOf(v.domain.split(".")[0]!).size, v.domain).toBe(1);
    }
    for (const v of result.variants) {
      const label = v.domain.split(".")[0]!;
      expect(label, "labels are lowercase after IDNA").toBe(label.toLowerCase());
    }
  });

  it("offers a script-specific TLD only labels in that script", async () => {
    const result = await scan("paypal.com", { tlds: ["com", "xn--p1ai"], top: 200 });
    for (const v of result.variants.filter((v) => v.domain.endsWith(".xn--p1ai"))) {
      expect([...v.domain.split(".")[0]!].every((ch) => getScript(ch) === "Cyrillic"), v.domain).toBe(true);
    }
  });
});
