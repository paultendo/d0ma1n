import type { DnsResult } from "../src/types.js";

/**
 * Registrars that hold names for brands (corporate and brand-protection registrars). A lookalike held through one of
 * these is most likely the brand defending itself. Meta runs two, RegistrarSafe and RegistrarSEC.
 */
export const BRAND_PROTECTION_REGISTRARS = [
  "markmonitor", "csc corporate domains", "com laude", "nom-iq", "registrarsafe", "registrarsec", "safenames",
  "corsearch", "brandsight", "lexsynergy", "ascio", "clarivate",
];
// Amazon Registrar and Google (now Squarespace) are left out: anyone can register through them, attackers included.
/** Groups of registrars run by one company, which a brand may use side by side. */
const REGISTRAR_FAMILIES = [["registrarsafe", "registrarsec"], ["com laude", "nom-iq"]];

const norm = (r: string) => r.toLowerCase().replace(/[.,]/g, " ").replace(/\b(inc|llc|ltd|limited|corp|corporation|dba|uab|gmbh)\b/g, " ").replace(/\s+/g, " ").trim();

/** Name servers run by brand-protection companies: a lookalike delegated to them is held for a brand. */
const BRAND_NS: [RegExp, string][] = [
  [/(^|\.)markmonitor\.com$/, "MarkMonitor"], [/(^|\.)cscdns\.(net|uk)$/, "CSC"], [/(^|\.)comlaude[a-z-]*\.(com|net|eu)$/, "Com Laude"],
  [/(^|\.)safenames\.(net|com)$/, "Safenames"],
];
/** Name servers that countless unrelated domains share (registrar and host defaults): sharing them proves nothing. */
const MASS_NS = /(^|\.)(domaincontrol\.com|registrar-servers\.com|dns-parking\.com|googledomains\.com|awsdns-[0-9]+\.[a-z.]+|name\.com|porkbun\.com|dynadot\.com|ui-dns\.[a-z.]+|ovh\.net|gandi\.net|digitalocean\.com|linode\.com|hetzner\.[a-z]+|namebrightdns\.com|hostinger\.[a-z]+|squarespacedns\.com|wixdns\.net|nsone\.net|dnsimple\.com|dnsmadeeasy\.com)$/;

type DnsFacts = { registrar?: string; ns?: string[]; spf?: string; dmarc?: string };
const host = (n: string) => n.toLowerCase().replace(/\.$/, "");
const mailboxes = (dmarc?: string) => new Set([...(dmarc ?? "").matchAll(/mailto:([^,;\s!]+)/gi)].map((m) => m[1]!.toLowerCase()));

/**
 * Whether a registered lookalike is probably the brand's own, and why. Strong evidence counts alone, and is costly
 * to fake: a brand-protection registrar; name servers at one of them, under the brand's own domain, in the brand's
 * Cloudflare account, or the brand's own set (a stranger who points a domain at name servers that do not host it
 * gets a domain that does not resolve). Supporting evidence counts only together with the same registrar: a shared
 * name server, the same DMARC report mailbox, or email records that name the brand's domain, which anyone can write.
 * The same registrar never counts alone, because attackers use popular registrars too.
 */
export function brandEvidence(brandDomain: string, brand: DnsFacts, v: DnsFacts): { holder: NonNullable<DnsResult["holder"]>; reason?: string } {
  const r = v.registrar ? norm(v.registrar) : "";
  if (r && BRAND_PROTECTION_REGISTRARS.some((x) => r.includes(x))) return { holder: "brand-protection-registrar", reason: "Registered through a registrar that only serves brands" };
  const ns = (v.ns ?? []).map(host), own = new Set((brand.ns ?? []).map(host));
  for (const n of ns) for (const [re, name] of BRAND_NS) if (re.test(n)) return { holder: "brand-protection-registrar", reason: "Name servers at " + name };
  const domain = brandDomain.toLowerCase();
  if (ns.some((n) => n === domain || n.endsWith("." + domain))) return { holder: "brand-dns", reason: "Name servers on " + domain };
  const esc = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = new RegExp("(include:|redirect=|@|\\.)" + esc + "(\\s|;|,|$)", "i");
  const sameSet = ns.length > 0 && ns.length === own.size && ns.every((n) => own.has(n));
  if (sameSet && ns.every((n) => n.endsWith(".ns.cloudflare.com"))) return { holder: "brand-dns", reason: "The same Cloudflare account as " + domain };
  if (sameSet && !ns.some((n) => MASS_NS.test(n))) return { holder: "brand-dns", reason: "The same name servers as " + domain };
  if (r && brand.registrar) {
    const b = norm(brand.registrar);
    const sameRegistrar = r === b || r.includes(b) || b.includes(r) ||
      REGISTRAR_FAMILIES.some((f) => f.some((x) => r.includes(x)) && f.some((x) => b.includes(x)));
    const sharedNs = ns.some((n) => own.has(n) && !MASS_NS.test(n));
    const ownBoxes = mailboxes(brand.dmarc), sameReports = [...mailboxes(v.dmarc)].some((m) => ownBoxes.has(m));
    const namesBrand = (!!v.spf && names.test(v.spf)) || (!!v.dmarc && names.test(v.dmarc));
    if (sameRegistrar && (sharedNs || sameReports || namesBrand)) {
      return { holder: "brand-registrar", reason: "The same registrar as " + domain +
        (sharedNs ? ", and a shared name server" : namesBrand ? ", and email records that name it" : ", and the same DMARC reports") };
    }
  }
  return { holder: "other-registrar" };
}
