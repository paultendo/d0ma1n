import type { DnsResult, DnsResolver } from "../src/types.js";

const DOH_URL = "https://cloudflare-dns.com/dns-query";

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

/** Query Cloudflare DoH for a specific record type. */
async function dohQuery(
  domain: string,
  type: string
): Promise<DohAnswer[]> {
  const url = `${DOH_URL}?name=${encodeURIComponent(domain)}&type=${type}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DohResponse;
    return data.Answer ?? [];
  } catch {
    return [];
  }
}

/** Create a DNS-over-HTTPS resolver using Cloudflare's 1.1.1.1. */
export function createDohResolver(): DnsResolver {
  return {
    async resolve(domain: string): Promise<DnsResult> {
      const [aAnswers, aaaaAnswers, mxAnswers, nsAnswers] = await Promise.all([
        dohQuery(domain, "A"),
        dohQuery(domain, "AAAA"),
        dohQuery(domain, "MX"),
        dohQuery(domain, "NS"),
      ]);

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

      const registered = a.length > 0 || aaaa.length > 0 || ns.length > 0;
      const hasMx = mx.length > 0;

      let threatLevel: DnsResult["threatLevel"] = "unregistered";
      if (hasMx) threatLevel = "active";
      else if (registered) threatLevel = "parked";

      return { registered, a, aaaa, mx, ns, hasMx, threatLevel };
    },
  };
}
