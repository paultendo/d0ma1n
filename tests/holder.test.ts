import { describe, expect, it } from "vitest";

import { brandEvidence } from "../worker/holder.js";

const paypal = {
  registrar: "MarkMonitor Inc.",
  ns: ["pdns100.ultradns.com", "pdns100.ultradns.net", "ns1-pchnet.paypal.com", "ns2-pchnet.paypal.com"],
  spf: "v=spf1 include:pp._spf.paypal.com ~all",
  dmarc: "v=DMARC1; p=reject; rua=mailto:d@rua.agari.com",
};

describe("brandEvidence", () => {
  it("counts name servers at a brand-protection company, even without the registry's record", () => {
    expect(brandEvidence("paypal.com", paypal, { ns: ["ns1.markmonitor.com", "ns2.markmonitor.com"] }))
      .toEqual({ holder: "brand-protection-registrar", reason: "Name servers at MarkMonitor" });
  });

  it("counts name servers under the brand's own domain, and not a name that merely contains it", () => {
    expect(brandEvidence("paypal.com", paypal, { ns: ["ns1-pchnet.paypal.com"] }).holder).toBe("brand-dns");
    expect(brandEvidence("paypal.com", paypal, { ns: ["ns1.paypal.com.evil.net"] }).holder).toBe("other-registrar");
  });

  it("never counts the same registrar alone, or shared mass-market name servers", () => {
    const small = { registrar: "GoDaddy.com, LLC", ns: ["ns01.domaincontrol.com", "ns02.domaincontrol.com"] };
    expect(brandEvidence("smallco.com", small, { registrar: "GoDaddy.com, LLC", ns: ["ns01.domaincontrol.com", "ns02.domaincontrol.com"] }).holder)
      .toBe("other-registrar");
  });

  it("treats email records that name the brand as supporting only, since anyone can write them", () => {
    const faked = { registrar: "NameCheap, Inc.", ns: ["dns1.registrar-servers.com"], spf: "v=spf1 include:_spf.paypal.com -all" };
    expect(brandEvidence("paypal.com", paypal, faked).holder).toBe("other-registrar");
    expect(brandEvidence("paypal.com", paypal, { ...faked, registrar: "MarkMonitor Inc." }).holder).toBe("brand-protection-registrar");
  });

  it("never counts email records, even with the same registrar, since anyone can write them", () => {
    const brand = { registrar: "GoDaddy.com, LLC", ns: ["ns1.brand-dns.net", "ns2.brand-dns.net"], dmarc: "v=DMARC1; p=reject; rua=mailto:dmarc@brand.com" };
    // An attacker at the brand's registrar who names the brand in SPF and sends DMARC reports to its mailbox
    const attacker = { registrar: "GoDaddy.com, LLC", ns: ["ns01.domaincontrol.com"], spf: "v=spf1 include:brand.com -all", dmarc: "v=DMARC1; p=none; rua=mailto:dmarc@brand.com" };
    expect(brandEvidence("brand.com", brand, attacker).holder).toBe("other-registrar");
    // A name server only the brand's DNS host would give it still counts, with the same registrar
    expect(brandEvidence("brand.com", brand, { registrar: "GoDaddy.com, LLC", ns: ["ns1.brand-dns.net", "ns9.other.net"] }).holder).toBe("brand-registrar");
  });

  it("doesn't count one shared Cloudflare name server: countless accounts share each", () => {
    const brand = { registrar: "GoDaddy.com, LLC", ns: ["adam.ns.cloudflare.com", "bella.ns.cloudflare.com"] };
    expect(brandEvidence("brand.io", brand, { registrar: "GoDaddy.com, LLC", ns: ["adam.ns.cloudflare.com", "carl.ns.cloudflare.com"] }).holder)
      .toBe("other-registrar");
  });

  it("counts the same Cloudflare account", () => {
    const cf = { ns: ["adam.ns.cloudflare.com", "bella.ns.cloudflare.com"] };
    expect(brandEvidence("brand.io", cf, { ns: ["bella.ns.cloudflare.com", "adam.ns.cloudflare.com"] }).holder).toBe("brand-dns");
  });
});
