import { domainToASCII } from "node:url";
import type { DnsResult, DnsResolver } from "../src/types.js";

const DOH_URL = "https://cloudflare-dns.com/dns-query";
const RDAP_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
/** RDAP lookups per scan: registries rate-limit, and only the most alike results need the registry's word. */
const RDAP_PER_SCAN = 20;
const DNS_SERVFAIL = 2;

type DohAnswer = {
  name: string;
  type: number;
  data: string;
  TTL: number;
};

type DohResponse = {
  Status: number;
  Answer?: DohAnswer[];
};

/** DNS record type numbers. */
const RR_A = 1;
const RR_AAAA = 28;
const RR_MX = 15;
const RR_NS = 2;

/** Query Cloudflare DoH for a specific record type. The name must be in ASCII (xn--) form: DoH refuses Unicode. */
async function dohQuery(domain: string, type: string): Promise<{ status?: number; answers: DohAnswer[] }> {
  const url = `${DOH_URL}?name=${encodeURIComponent(domain)}&type=${type}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { answers: [] };
    const data = (await res.json()) as DohResponse;
    return { status: data.Status, answers: data.Answer ?? [] };
  } catch {
    return { answers: [] };
  }
}

/** RDAP base URLs by TLD, from IANA's bootstrap file (fetched once per isolate). */
let rdapBases: Promise<Map<string, string>> | null = null;
function rdapBase(tld: string): Promise<string | undefined> {
  rdapBases ??= fetch(RDAP_BOOTSTRAP, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json() as Promise<{ services: [string[], string[]][] }>)
    .then((j) => {
      const m = new Map<string, string>();
      for (const [tlds, urls] of j.services) for (const t of tlds) m.set(t, urls[0]!.replace(/\/?$/, "/"));
      return m;
    })
    .catch(() => new Map<string, string>());
  return rdapBases.then((m) => m.get(tld));
}

/** The registry's own record: whether the name is registered, and when and through whom. Undefined when unknown. */
async function rdapLookup(ascii: string): Promise<DnsResult["rdap"] | undefined> {
  const base = await rdapBase(ascii.split(".").pop()!);
  if (!base) return undefined;
  try {
    const res = await fetch(`${base}domain/${ascii}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return { registered: false };
    if (!res.ok) return undefined;
    const j = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[];
    };
    const since = j.events?.find((e) => e.eventAction === "registration")?.eventDate?.slice(0, 10);
    const registrar = j.entities?.find((e) => e.roles?.includes("registrar"))?.vcardArray?.[1]
      ?.find((f) => f[0] === "fn")?.[3];
    return { registered: true, ...(since ? { since } : {}), ...(registrar ? { registrar } : {}) };
  } catch {
    return undefined;
  }
}

/** Create a DNS-over-HTTPS resolver using Cloudflare's 1.1.1.1. */
export function createDohResolver(): DnsResolver {
  let rdapLeft = RDAP_PER_SCAN;
  return {
    async resolve(domain: string): Promise<DnsResult> {
      const ascii = domainToASCII(domain) || domain;
      const [aRes, aaaaRes, mxRes, nsRes] = await Promise.all([
        dohQuery(ascii, "A"),
        dohQuery(ascii, "AAAA"),
        dohQuery(ascii, "MX"),
        dohQuery(ascii, "NS"),
      ]);
      const [aAnswers, aaaaAnswers, mxAnswers, nsAnswers] = [aRes.answers, aaaaRes.answers, mxRes.answers, nsRes.answers];

      const a = aAnswers
        .filter((r) => r.type === RR_A)
        .map((r) => r.data);
      const aaaa = aaaaAnswers
        .filter((r) => r.type === RR_AAAA)
        .map((r) => r.data);
      const mx = mxAnswers
        .filter((r) => r.type === RR_MX)
        .map((r) => {
          const parts = r.data.split(" ");
          return {
            priority: parseInt(parts[0], 10) || 0,
            exchange: parts[1]?.replace(/\.$/, "") ?? "",
          };
        });
      const ns = nsAnswers
        .filter((r) => r.type === RR_NS)
        .map((r) => r.data.replace(/\.$/, ""));

      // A server failure means the name is delegated but its DNS is broken: registered, not free
      let registered = a.length > 0 || aaaa.length > 0 || ns.length > 0 || nsRes.status === DNS_SERVFAIL;
      const hasMx = mx.length > 0;

      // No DNS doesn't mean unregistered (held names, names without nameservers), and for a registered name the
      // registrar says a lot (a brand-protection registrar suggests the brand holds it): ask the registry
      let rdap: DnsResult["rdap"] | undefined;
      if (rdapLeft > 0) {
        rdapLeft--;
        rdap = await rdapLookup(ascii);
        if (rdap?.registered) registered = true;
      }

      let threatLevel: DnsResult["threatLevel"] = "unregistered";
      if (hasMx) threatLevel = "active";
      else if (registered) threatLevel = "parked";

      return { registered, a, aaaa, mx, ns, hasMx, threatLevel, ...(rdap ? { rdap } : {}) };
    },
  };
}
