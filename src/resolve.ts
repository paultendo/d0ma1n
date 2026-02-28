import dns from "node:dns/promises";
import type { DnsResult, DnsResolver, ResolveOptions } from "./types.js";

/** Simple semaphore for concurrency control. */
class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

/** Resolve a single DNS record type, returning empty array on failure. */
async function safeResolve<T>(
  fn: () => Promise<T[]>,
  timeoutMs: number
): Promise<T[]> {
  try {
    const result = await Promise.race([
      fn(),
      new Promise<T[]>((_, reject) =>
        setTimeout(() => reject(new Error("DNS timeout")), timeoutMs)
      ),
    ]);
    return result;
  } catch {
    return [];
  }
}

/** Create a Node.js DNS resolver. */
export function createNodeResolver(options?: ResolveOptions): DnsResolver {
  const concurrency = options?.concurrency ?? 10;
  const timeout = options?.timeout ?? 3000;
  const semaphore = new Semaphore(concurrency);

  return {
    async resolve(domain: string): Promise<DnsResult> {
      await semaphore.acquire();
      try {
        const [a, aaaa, mx, ns] = await Promise.all([
          safeResolve(() => dns.resolve4(domain), timeout),
          safeResolve(() => dns.resolve6(domain), timeout),
          safeResolve(
            () =>
              dns.resolveMx(domain).then((records) =>
                records.map((r) => ({
                  priority: r.priority,
                  exchange: r.exchange,
                }))
              ),
            timeout
          ),
          safeResolve(() => dns.resolveNs(domain), timeout),
        ]);

        const registered = a.length > 0 || aaaa.length > 0 || ns.length > 0;
        const hasMx = mx.length > 0;

        let threatLevel: DnsResult["threatLevel"] = "unregistered";
        if (hasMx) {
          threatLevel = "active";
        } else if (registered) {
          threatLevel = "parked";
        }

        return { registered, a, aaaa, mx, ns, hasMx, threatLevel };
      } finally {
        semaphore.release();
      }
    },
  };
}
