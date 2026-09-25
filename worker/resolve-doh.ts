import { domainToASCII } from "node:url";
import type { DnsResult, DnsResolver } from "../src/types.js";
import { batchQuery, TYPE_MX, TYPE_NS } from "./dns-batch.js";

const DOH_URL = "https://cloudflare-dns.com/dns-query";
const RDAP_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
/** RDAP lookups per scan: registries rate-limit, and only the most alike results need the registry's word. */
const RDAP_PER_SCAN = 20;
const RDAP_CONCURRENCY = 4;
const DNS_SERVFAIL = 2;
/** Registries and IANA refuse anonymous requests; say who is asking. */
const UA = "d0ma1n/1.0 (+https://d0ma1n.app)";

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
  rdapBases ??= fetch(RDAP_BOOTSTRAP, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) })
    .then((r) => {
      if (!r.ok) console.log(`rdap bootstrap: HTTP ${r.status}`);
      return r.json() as Promise<{ services: [string[], string[]][] }>;
    })
    .then((j) => {
      const m = new Map<string, string>();
      for (const [tlds, urls] of j.services) for (const t of tlds) m.set(t, urls[0]!.replace(/\/?$/, "/"));
      return m;
    })
    .catch((e) => {
      console.log(`rdap bootstrap failed: ${e}`);
      rdapBases = null;
      return new Map<string, string>();
    });
  return rdapBases.then((m) => m.get(tld));
}

/** The registry's own record: whether the name is registered, and when and through whom. Undefined when unknown. */
export async function rdapLookup(ascii: string): Promise<DnsResult["rdap"] | undefined> {
  const base = await rdapBase(ascii.split(".").pop()!);
  if (!base) return undefined;
  try {
    const res = await fetch(`${base}domain/${ascii}`, {
      headers: { Accept: "application/rdap+json", "User-Agent": UA },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return { registered: false };
    if (!res.ok) {
      console.log(`rdap ${ascii}: HTTP ${res.status}`);
      return undefined;
    }
    const j = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[];
    };
    const since = j.events?.find((e) => e.eventAction === "registration")?.eventDate?.slice(0, 10);
    const registrar = j.entities?.find((e) => e.roles?.includes("registrar"))?.vcardArray?.[1]
      ?.find((f) => f[0] === "fn")?.[3];
    return { registered: true, ...(since ? { since } : {}), ...(registrar ? { registrar } : {}) };
  } catch (e) {
    console.log(`rdap ${ascii} failed: ${e}`);
    return undefined;
  }
}

/**
 * The fallback: DNS-over-HTTPS, one request per query, budgeted. A Worker on the free plan may make 50 outgoing
 * requests per invocation, so only the most alike names get a nameserver query, and mail servers only for registered
 * names. Names past the budget come back unchecked rather than unregistered.
 */
function dohFallback(budget: { names: number; extra: number }) {
  return async (ascii: string): Promise<Omit<DnsResult, "rdap"> & { checked: boolean }> => {
    if (budget.names <= 0) return { registered: false, ...EMPTY, threatLevel: "unregistered", checked: false };
    budget.names--;
    const nsRes = await dohQuery(ascii, "NS");
    const ns = nsRes.answers.filter((r) => r.type === RR_NS).map((r) => r.data.replace(/\.$/, ""));
    const registered = ns.length > 0 || nsRes.status === DNS_SERVFAIL;
    let mx: DnsResult["mx"] = [];
    if (registered && budget.extra > 0) {
      budget.extra--;
      mx = (await dohQuery(ascii, "MX")).answers.filter((r) => r.type === RR_MX).map((r) => {
        const parts = r.data.split(" ");
        return { priority: parseInt(parts[0]!, 10) || 0, exchange: parts[1]?.replace(/\.$/, "") ?? "" };
      });
    }
    return { registered, a: [], aaaa: [], mx, ns, hasMx: mx.length > 0, threatLevel: "unregistered", checked: true };
  };
}

const EMPTY = { a: [] as string[], aaaa: [] as string[], mx: [] as DnsResult["mx"], ns: [] as string[], hasMx: false };

/**
 * A resolver for one scan. Every name the scan asks about in one go is looked up together: nameservers and mail
 * servers for all of them over a single DNS-over-TLS connection (one outgoing request, however many names), then the
 * registry's RDAP record for the most alike, which also settles names DNS can't (held names, broken delegations)
 * and says when and through whom each was registered. If the socket fails, it falls back to budgeted DoH.
 */
export function createDohResolver(): DnsResolver {
  let queue: { ascii: string; done: (r: DnsResult) => void }[] = [];
  let rdapLeft = RDAP_PER_SCAN;
  const fallback = dohFallback({ names: 28, extra: 12 });

  async function flush(items: typeof queue) {
    let dns: (Omit<DnsResult, "rdap"> & { checked: boolean })[];
    try {
      const answers = await batchQuery(items.flatMap((it) => [
        { name: it.ascii, type: TYPE_NS },
        { name: it.ascii, type: TYPE_MX },
      ]));
      if (answers.every((a) => a === undefined)) throw new Error("no DNS answers over TLS");
      dns = items.map((_, i) => {
        const ns = answers[2 * i], mx = answers[2 * i + 1];
        if (!ns) return { registered: false, ...EMPTY, threatLevel: "unregistered", checked: false };
        // A server failure means the name is delegated but its DNS is broken: registered, not free
        const registered = ns.ns.length > 0 || ns.rcode === DNS_SERVFAIL;
        const mxs = registered ? (mx?.mx ?? []) : [];
        return { registered, a: [], aaaa: [], mx: mxs, ns: ns.ns, hasMx: mxs.length > 0, threatLevel: "unregistered", checked: true };
      });
    } catch (e) {
      console.log(`dns batch failed, falling back to DoH: ${e}`);
      dns = await Promise.all(items.map((it) => fallback(it.ascii)));
    }

    // Registries throttle bursts, so RDAP goes a few at a time, most alike first
    const rdaps: (DnsResult["rdap"] | undefined)[] = new Array(items.length);
    const wanted = items.map((_, i) => i).filter((i) => dns[i]!.checked).slice(0, rdapLeft);
    rdapLeft -= wanted.length;
    for (let k = 0; k < wanted.length; k += RDAP_CONCURRENCY) {
      await Promise.all(wanted.slice(k, k + RDAP_CONCURRENCY).map(async (i) => {
        rdaps[i] = await rdapLookup(items[i]!.ascii)
          ?? await new Promise((w) => setTimeout(w, 300)).then(() => rdapLookup(items[i]!.ascii));
      }));
    }

    await Promise.all(items.map(async (it, i) => {
      const d = dns[i]!;
      const rdap = rdaps[i];
      const registered = d.registered || rdap?.registered === true;
      const threatLevel: DnsResult["threatLevel"] = d.hasMx ? "active" : registered ? "parked" : "unregistered";
      const { checked, ...rest } = d;
      it.done({ ...rest, registered, threatLevel, ...(checked ? {} : { checked: false }), ...(rdap ? { rdap } : {}) });
    }));
  }

  return {
    resolve(domain: string): Promise<DnsResult> {
      return new Promise((done) => {
        if (queue.length === 0) {
          // Gather every name asked for in this turn, then look them all up together
          setTimeout(() => {
            const items = queue;
            queue = [];
            void flush(items);
          }, 0);
        }
        queue.push({ ascii: domainToASCII(domain) || domain, done });
      });
    },
  };
}

/**
 * Registrars that hold names for brands (corporate and brand-protection registrars). A lookalike held through one of
 * these is most likely the brand defending itself. Meta runs two, RegistrarSafe and RegistrarSEC.
 */
const BRAND_PROTECTION_REGISTRARS = [
  "markmonitor", "csc corporate domains", "com laude", "nom-iq", "registrarsafe", "registrarsec", "safenames",
  "corsearch", "brandsight", "lexsynergy", "ascio", "amazon registrar", "google llc", "clarivate",
];
/** Groups of registrars run by one company, which a brand may use side by side. */
const REGISTRAR_FAMILIES = [["registrarsafe", "registrarsec"], ["com laude", "nom-iq"]];

const norm = (r: string) => r.toLowerCase().replace(/[.,]/g, " ").replace(/\b(inc|llc|ltd|limited|corp|corporation|dba|uab|gmbh)\b/g, " ").replace(/\s+/g, " ").trim();

/** How a registered lookalike's registrar compares with the brand's own. */
export function registrarHolder(brandRegistrar: string | undefined, registrar: string): NonNullable<DnsResult["holder"]> {
  const r = norm(registrar);
  if (brandRegistrar) {
    const b = norm(brandRegistrar);
    if (r === b || r.includes(b) || b.includes(r)) return "brand-registrar";
    if (REGISTRAR_FAMILIES.some((f) => f.some((x) => r.includes(x)) && f.some((x) => b.includes(x)))) return "brand-registrar";
  }
  return BRAND_PROTECTION_REGISTRARS.some((x) => r.includes(x)) ? "brand-protection-registrar" : "other-registrar";
}
