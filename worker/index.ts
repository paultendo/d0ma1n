import { generateVariants } from "../src/generate.js";
import { scoreVariants } from "../src/score.js";
import { buildPrototypeBuckets } from "../src/reverse-map.js";
import { splitDomain, getTargetTlds } from "../src/tld.js";
import { reverseScan, fromPunycode } from "../src/reverse-scan.js";
import { createDohResolver } from "./resolve-doh.js";
import { renderLandingPage, renderScanPage, renderTermsPage } from "./page.js";
import type { DomainVariant, ScanResult } from "../src/types.js";

interface Env {
  SCAN_CACHE: KVNamespace;
}

/** KV cache TTL: 1 hour. DNS can change, but not that fast. */
const CACHE_TTL = 3600;

/** In-memory rate limiter (per-isolate; best-effort). */
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, cost: number = 1): boolean {
  const now = Date.now();
  const window = 60_000;
  const maxRequests = 10;

  let entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + window };
  }

  entry.count += cost;
  rateLimits.set(ip, entry);

  if (rateLimits.size > 1000) {
    for (const [k, v] of rateLimits) {
      if (now > v.resetAt) rateLimits.delete(k);
    }
  }

  return entry.count <= maxRequests;
}

/** CORS headers. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Module-level bucket cache. Built once per isolate, reused across requests. */
let cachedBuckets: ReturnType<typeof buildPrototypeBuckets> | null = null;

function getBuckets() {
  if (!cachedBuckets) {
    cachedBuckets = buildPrototypeBuckets({ maxPerChar: 10 });
  }
  return cachedBuckets;
}

/**
 * Run a scan: generate variants, score, optionally resolve DNS.
 * maxEdits clamped to 1 to keep CPU predictable.
 */
async function runScan(
  domain: string,
  options: {
    resolve?: boolean;
    top?: number;
    font?: string;
    threshold?: number;
    useMaxDanger?: boolean;
  }
): Promise<ScanResult> {
  const { label, tld } = splitDomain(domain);
  const top = Math.min(200, options.top ?? 20);
  const threshold = options.threshold ?? 0;

  const buckets = getBuckets();

  const rawVariants = generateVariants(
    label,
    { maxEdits: 1, maxPerChar: 10, maxVariants: 2000, useMaxDanger: options.useMaxDanger },
    buckets
  );

  const totalGenerated = rawVariants.length;

  const scripts = new Set<string>();
  for (const v of rawVariants) {
    for (const s of v.substitutions) scripts.add(s.script);
  }

  const tlds = getTargetTlds({ baseTlds: [tld], scripts });

  let allVariants: DomainVariant[] = [];
  for (const targetTld of tlds) {
    const scored = scoreVariants(rawVariants, targetTld, {
      useMaxDanger: options.useMaxDanger,
      font: options.font,
    });
    allVariants.push(...scored);
  }

  allVariants = allVariants.filter((v) => v.dangerScore >= threshold);
  allVariants.sort((a, b) => b.dangerScore - a.dangerScore);
  allVariants = allVariants.slice(0, top);

  if (options.resolve) {
    const resolver = createDohResolver();
    await Promise.all(
      allVariants.map(async (v) => {
        v.dns = await resolver.resolve(v.domain);
      })
    );

    allVariants.sort((a, b) => {
      const aReg = a.dns?.registered ? 1 : 0;
      const bReg = b.dns?.registered ? 1 : 0;
      if (aReg !== bReg) return bReg - aReg;
      const aActive = a.dns?.threatLevel === "active" ? 1 : 0;
      const bActive = b.dns?.threatLevel === "active" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.dangerScore - a.dangerScore;
    });
  }

  return { original: domain, label, tld, totalGenerated, variants: allVariants };
}

/**
 * Get a scan result from KV cache, or run the scan and cache it.
 * Cache key includes domain + top + font. TTL = 1 hour.
 *
 * Budget: 1,000 writes/day = 1,000 unique scans cached.
 *         100,000 reads/day = unlimited cache hits.
 */
/**
 * Get a scan result from KV cache, or run the scan and cache it.
 *
 * Cache strategy: always store with threshold=0 and max top (200).
 * Filter threshold and slice top at serve time. This means one KV entry
 * serves all threshold/top combinations for the same domain+font+resolve.
 *
 * Budget: 1,000 writes/day = 1,000 unique scans cached.
 *         100,000 reads/day = unlimited cache hits.
 */
async function cachedScan(
  kv: KVNamespace,
  domain: string,
  options: { resolve?: boolean; top?: number; font?: string; threshold?: number; useMaxDanger?: boolean }
): Promise<ScanResult> {
  const resolve = options.resolve ?? true;
  const font = options.font ?? "";
  const cacheKey = `v1:${domain}:${resolve}:${font}`;

  // Try KV cache first (free read)
  const cached = await kv.get(cacheKey, "json") as ScanResult | null;
  if (cached) {
    return applyFilters(cached, options.threshold ?? 0, options.top ?? 20);
  }

  // Cache miss: run with threshold=0, top=200 to maximize cache reuse
  const result = await runScan(domain, {
    ...options,
    threshold: 0,
    top: 200,
  });

  // Write to KV (costs 1 of 1,000 daily writes)
  await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });

  return applyFilters(result, options.threshold ?? 0, options.top ?? 20);
}

/** Apply threshold filter and top cap to a cached result. */
function applyFilters(result: ScanResult, threshold: number, top: number): ScanResult {
  if (threshold === 0 && top >= result.variants.length) return result;
  const filtered = result.variants
    .filter((v) => v.dangerScore >= threshold)
    .slice(0, top);
  return { ...result, variants: filtered };
}

/** Validate and normalize a domain input. Returns cleaned domain or error message. */
function validateDomain(raw: string): { domain: string } | { error: string } {
  let d = raw.trim().toLowerCase();
  // Strip protocol if someone pastes a URL
  d = d.replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/.*$/, "");
  // Strip email prefix
  if (d.includes("@")) d = d.split("@").pop()!;
  // Strip www.
  d = d.replace(/^www\./, "");
  // Strip trailing dot
  d = d.replace(/\.$/, "");
  // Strip port
  d = d.replace(/:\d+$/, "");

  if (!d || !d.includes(".")) {
    return { error: "Enter a domain name (e.g. paypal.com)" };
  }

  // Reject IP addresses
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d) || d.startsWith("[")) {
    return { error: "IP addresses cannot be spoofed with confusables. Enter a domain name." };
  }

  const label = d.split(".")[0];

  if (label.length === 0) {
    return { error: "Invalid domain" };
  }
  if (label.length > 63) {
    return { error: "Label too long (max 63 characters)" };
  }
  if (d.length > 253) {
    return { error: "Domain too long (max 253 characters)" };
  }

  return { domain: d };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const ip =
      request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For") ??
      "unknown";

    // GET / - Landing page
    if (path === "/" || path === "") {
      return htmlResponse(renderLandingPage());
    }

    // GET /terms - Terms of use
    if (path === "/terms") {
      return htmlResponse(renderTermsPage());
    }

    // GET /scan/:domain - Shareable results page (embedded data, 1 request)
    if (path.startsWith("/scan/")) {
      const input = validateDomain(decodeURIComponent(path.slice(6)));
      if ("error" in input) {
        return htmlResponse(`<p>${input.error}</p>`, 400);
      }

      if (!checkRateLimit(ip, 5)) {
        return htmlResponse("<p>Rate limit exceeded. Try again in a minute.</p>", 429);
      }

      const result = await cachedScan(env.SCAN_CACHE, input.domain, { resolve: true, top: 50 });
      return htmlResponse(renderScanPage(result));
    }

    // GET /api/scan - Generate + score + resolve in one request
    if (path === "/api/scan") {
      const input = validateDomain(url.searchParams.get("domain") ?? "");
      if ("error" in input) {
        return jsonResponse({ error: input.error }, 400);
      }

      const resolve = url.searchParams.get("resolve") !== "false";
      const cost = resolve ? 5 : 1;
      if (!checkRateLimit(ip, cost)) {
        return jsonResponse({ error: "Rate limit exceeded" }, 429);
      }

      const top = Math.min(200, parseInt(url.searchParams.get("top") ?? "20", 10));
      const font = url.searchParams.get("font") ?? undefined;
      const threshold = parseFloat(url.searchParams.get("threshold") ?? "0");
      const useMaxDanger = url.searchParams.get("use_max_danger") === "true";

      const result = await cachedScan(env.SCAN_CACHE, input.domain, {
        resolve,
        top,
        font,
        threshold,
        useMaxDanger,
      });
      return jsonResponse(result);
    }

    // GET /api/reverse?domain=... - Reverse lookup (pure CPU, no caching needed)
    if (path === "/api/reverse") {
      const domain = url.searchParams.get("domain");
      if (!domain) {
        return jsonResponse({ error: "domain parameter required" }, 400);
      }

      if (!checkRateLimit(ip)) {
        return jsonResponse({ error: "Rate limit exceeded" }, 429);
      }

      const result = reverseScan(domain);
      return jsonResponse(result);
    }

    return htmlResponse("<p>Not found</p>", 404);
  },
};
