import { domainToASCII } from "node:url";
import type { DnsResult, DnsResolver, ResolveHint } from "../src/types.js";
export { brandEvidence } from "./holder.js";
import { batchQuery, TYPE_A, TYPE_MX, TYPE_NS, TYPE_TXT } from "./dns-batch.js";

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

type RdapEntity = { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]]; entities?: RdapEntity[] };

/**
 * Parking and domain-marketplace services, by their name servers. A lookalike parked with one is usually for sale or
 * earning from ads, not phishing, and a brand may be able to buy it.
 */
const PARKING: [RegExp, string][] = [
  [/(^|\.)sedoparking\.com$/, "Sedo"], [/(^|\.)bodis\.com$/, "Bodis"], [/(^|\.)parkingcrew\.net$/, "ParkingCrew"],
  [/(^|\.)above\.com$/, "Above"], [/(^|\.)(dan\.com|undeveloped\.com)$/, "Dan"], [/(^|\.)afternic\.com$/, "Afternic"],
  [/(^|\.)parklogic\.com$/, "ParkLogic"], [/(^|\.)dns-parking\.com$/, "Hostinger parking"],
  [/(^|\.)uniregistrymarket\.link$/, "Uniregistry"], [/(^|\.)hugedomains\.com$/, "HugeDomains"],
];
// Only name servers used for nothing but parking: a registrar's default DNS also serves live sites, so it proves nothing.
export function parkedWith(ns: string[]): string | undefined {
  for (const n of ns) for (const [re, name] of PARKING) if (re.test(n.toLowerCase().replace(/\.$/, ""))) return name;
  return undefined;
}

/** Whether an SPF record authorises anyone to send: "v=spf1 -all" on its own says the domain sends no mail. */
export function authorisesSenders(spf: string | undefined): boolean {
  if (!spf) return false;
  return /\s(\+?(include:|a\b|a:|mx\b|mx:|ip4:|ip6:|exists:)|redirect=)/i.test(" " + spf);
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
      entities?: RdapEntity[];
      status?: string[];
    };
    const since = j.events?.find((e) => e.eventAction === "registration")?.eventDate?.slice(0, 10);
    const expires = j.events?.find((e) => e.eventAction === "expiration")?.eventDate?.slice(0, 10);
    const reg = j.entities?.find((e) => e.roles?.includes("registrar"));
    const registrar = reg?.vcardArray?.[1]?.find((f) => f[0] === "fn")?.[3];
    // The registrar's abuse contact sits in an entity nested under the registrar
    const abuse = reg?.entities?.find((e) => e.roles?.includes("abuse"))?.vcardArray?.[1]?.find((f) => f[0] === "email")?.[3];
    // RDAP writes status in words ("client hold"); EPP codes are camelCase (clientHold)
    const status = (j.status ?? []).map((s) => s.replace(/ (\w)/g, (_, c: string) => c.toUpperCase()));
    return {
      registered: true, ...(since ? { since } : {}), ...(registrar ? { registrar } : {}),
      ...(status.length ? { status } : {}), ...(expires ? { expires } : {}),
      ...(typeof abuse === "string" && abuse.includes("@") ? { abuse: abuse.replace(/^mailto:/, "") } : {}),
    };
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
/** Whether MX records say the domain takes mail. A single record with an empty exchange ("null MX", RFC 7505) is a
 * domain declaring that it takes none, so it does not count. */
export function acceptsMail(mx: DnsResult["mx"]): boolean {
  return mx.some((m) => m.exchange !== "" && m.exchange !== ".");
}

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
    return { registered, a: [], aaaa: [], mx, ns, hasMx: acceptsMail(mx), threatLevel: "unregistered", checked: true };
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
  let queue: { ascii: string; registrable?: boolean; done: (r: DnsResult) => void }[] = [];
  let rdapLeft = RDAP_PER_SCAN;
  const fallback = dohFallback({ names: 28, extra: 12 });

  async function flush(items: typeof queue) {
    let dns: (Omit<DnsResult, "rdap"> & { checked: boolean })[];
    try {
      // Per name, on the one connection: name servers and mail servers, then whether it has a website (A), whether it
      // is authorised to send mail (SPF, in TXT) and its DMARC policy
      const Q = 5;
      const answers = await batchQuery(items.flatMap((it) => [
        { name: it.ascii, type: TYPE_NS },
        { name: it.ascii, type: TYPE_MX },
        { name: it.ascii, type: TYPE_A },
        { name: it.ascii, type: TYPE_TXT },
        { name: `_dmarc.${it.ascii}`, type: TYPE_TXT },
      ]));
      if (answers.every((a) => a === undefined)) throw new Error("no DNS answers over TLS");
      dns = items.map((_, i) => {
        const ns = answers[Q * i], mx = answers[Q * i + 1], a = answers[Q * i + 2], txt = answers[Q * i + 3], dm = answers[Q * i + 4];
        if (!ns) return { registered: false, ...EMPTY, threatLevel: "unregistered", checked: false };
        // A server failure means the name is delegated but its DNS is broken: registered, not free
        const registered = ns.ns.length > 0 || ns.rcode === DNS_SERVFAIL;
        const mxs = registered ? (mx?.mx ?? []) : [];
        const spf = registered ? txt?.txt.find((t) => /^v=spf1(\s|$)/i.test(t)) : undefined;
        const dmarc = registered ? dm?.txt.find((t) => /^v=DMARC1/i.test(t)) : undefined;
        const parking = registered ? parkedWith(ns.ns) : undefined;
        return {
          registered, a: registered ? (a?.a ?? []) : [], aaaa: [], mx: mxs, ns: ns.ns, hasMx: acceptsMail(mxs),
          ...(spf ? { spf } : {}), ...(dmarc ? { dmarc } : {}), ...(parking ? { parking } : {}),
          threatLevel: "unregistered", checked: true,
        };
      });
    } catch (e) {
      console.log(`dns batch failed, falling back to DoH: ${e}`);
      // Each fallback lookup is a request against a budget, so names a registry would accept go first
      const order = items.map((_, i) => i).sort((p, q) => Number(items[p]!.registrable === false) - Number(items[q]!.registrable === false));
      const found: typeof dns = new Array(items.length);
      const calls = order.map((i) => fallback(items[i]!.ascii).then((r) => { found[i] = r; }));
      await Promise.all(calls);
      dns = found;
    }

    // Registries throttle bursts, so RDAP goes a few at a time, most alike first
    const rdaps: (DnsResult["rdap"] | undefined)[] = new Array(items.length);
    // RDAP is one request per name against a small budget. It is worth asking for a registered name (who holds it)
    // and for one that could be registered (is it really free). A name DNS cannot find and the registry would refuse
    // cannot be registered, so asking adds nothing.
    const wanted = items.map((_, i) => i)
      .filter((i) => dns[i]!.checked && (dns[i]!.registered || items[i]!.registrable !== false))
      .slice(0, rdapLeft);
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
      // Set up for email either way: mail servers to receive it, or an SPF record authorising senders
      const threatLevel: DnsResult["threatLevel"] = registered && (d.hasMx || authorisesSenders(d.spf)) ? "active"
        : registered ? "parked" : "unregistered";
      const { checked, ...rest } = d;
      it.done({ ...rest, registered, threatLevel, ...(checked ? {} : { checked: false }), ...(rdap ? { rdap } : {}) });
    }));
  }

  return {
    resolve(domain: string, hint?: ResolveHint): Promise<DnsResult> {
      return new Promise((done) => {
        if (queue.length === 0) {
          // Gather every name asked for in this turn, then look them all up together
          setTimeout(() => {
            const items = queue;
            queue = [];
            void flush(items);
          }, 0);
        }
        queue.push({ ascii: domainToASCII(domain) || domain, registrable: hint?.registrable, done });
      });
    },
  };
}

