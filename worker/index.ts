import { scan } from "../src/scan.js";
import { buildPrototypeBuckets } from "../src/reverse-map.js";
import { reverseScan, fromPunycode } from "../src/reverse-scan.js";
import { createDohResolver } from "./resolve-doh.js";
import { renderLandingPage, renderScanPage, renderTermsPage, type LandingData } from "./page.js";
import type { ScanResult } from "../src/types.js";
import { getBlock, toCodepoint } from "../src/reverse-map.js";
import { outsideRepertoire, registryRule } from "../src/policy/repertoire.js";
import { evaluateDomainLabel, getDomainPolicyProfileForTld } from "../src/policy/index.js";
import { TLD_RULES } from "../src/policy/repertoire-data.js";
import { FONT_SPECIFIC_WEIGHTS } from "namespace-guard/font-specific-weights";

interface Env {
  SCAN_CACHE: KVNamespace;
}

/**
 * The homepage's specimens, computed from the same data the scanner uses so the page cannot drift from it: each fake is
 * looked up in a real scan of its brand, font verdicts come from the per-font weights, and registry verdicts from the
 * registry rules. Fakes whose swapped glyph Arial draws natively, so they really are indistinguishable on screen.
 */
const SPECIMENS: [string, string][] = [
  ["google.com", "g\u1D0Fogle.com"],
  ["visa.com", "\u1D20isa.com"],
  ["coinbase.com", "c\u1D0Finbase.com"],
  ["microsoft.com", "micr\u1D0Fsoft.com"],
  ["facebook.com", "faceb\u1D0Fok.com"],
];
/** Unicode names for the swapped characters above (UnicodeData.txt). */
const CHAR_NAMES: Record<string, string> = {
  "\u1D0F": "LATIN LETTER SMALL CAPITAL O",
  "\u1D20": "LATIN LETTER SMALL CAPITAL V",
};
const STRIP_FONTS = ["Arial", "Times New Roman", "Courier New", "Tahoma", "Georgia", "Verdana", "Trebuchet MS", "Helvetica"];
const BOARD_TLDS = ["com", "net", "org", "name", "de", "fr", "co.uk", "io", "jp", "рф", "eu", "xyz"];

let landing: LandingData | null = null;

async function landingData(): Promise<LandingData> {
  if (landing) return landing;
  const examples: LandingData["examples"] = [];
  for (const [real, fake] of SPECIMENS) {
    const result = await scan(real, { buckets: getBuckets(), maxEdits: 1, top: 500 });
    const v = result.variants.find((x) => x.domain === fake);
    if (!v || v.substitutions.length !== 1) continue;
    const sub = v.substitutions[0]!;
    examples.push({
      real, fake, index: sub.position, original: sub.original, char: sub.replacement,
      codepoint: toCodepoint(sub.replacement), name: CHAR_NAMES[sub.replacement] ?? "", block: getBlock(sub.replacement),
      similarity: Math.round(v.dangerScore * 100), registrable: v.policy?.registrable ?? false, punycode: v.punycode,
      registration: await createDohResolver().resolve(fake).then((d) => ({
        registered: d.registered, since: d.rdap?.since, registrar: d.rdap?.registrar,
      })).catch(() => null),
    });
  }
  const [real, fake] = ["o", "\u1D0F"];
  const fonts = FONT_SPECIFIC_WEIGHTS as Record<string, Record<string, Record<string, { danger: number }>>>;
  const fontStrip = STRIP_FONTS.map((font) => ({
    font, danger: fonts[font]?.[fake]?.[real]?.danger ?? fonts[font]?.[real]?.[fake]?.danger ?? null,
  }));
  const label = "g\u1D0Fogle";
  const registries = BOARD_TLDS.map((tld) => {
    // The scanner's full check (registry tables and the single-script rule), so the board and a scan agree
    const known = outsideRepertoire(label, tld) !== undefined;
    const rule = registryRule(tld);
    return {
      tld, accepts: known ? evaluateDomainLabel(label, { tld, profile: getDomainPolicyProfileForTld(tld) }).registrable : null,
      rule: rule.kind, assumed: rule.kind === "ascii" && rule.assumed === true,
    };
  });
  landing = {
    examples, fontStrip, strip: { real: "google", fake: label }, registries,
    stats: { tlds: Object.keys(TLD_RULES).length, fonts: Object.keys(fonts).length },
  };
  return landing;
}

/**
 * What the site and API show of a scan. The scanner models phone camera banners for scoring, but how particular
 * cameras display lookalikes stays out of public output while a vendor fix is pending.
 */
function publicResult(result: ScanResult): ScanResult {
  return {
    ...result,
    variants: result.variants.map((v) => {
      if (!v.policy) return v;
      const { androidCamera: _a, iosCamera: _i, ...surfaces } = v.policy.surfaces;
      return {
        ...v,
        policy: {
          ...v.policy,
          surfaces: surfaces as typeof v.policy.surfaces,
          reasons: v.policy.reasons.filter((x) => x.code !== "decoded-by-camera"),
          notes: v.policy.notes.filter((n) => !/camera/i.test(n)),
        },
      };
    }),
  };
}

/** KV cache TTL: 1 hour. DNS can change, but not that fast. */
const CACHE_TTL = 3600;

/** In-memory rate limiter (per-isolate; best-effort). */
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, cost: number = 1): boolean {
  const now = Date.now();
  const window = 60_000;
  const maxRequests = 30;

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
    // Uncapped: whole-script replacement needs each letter's substitute in that script even when it ranks low
    // (Cyrillic ӏ for l in раураӏ); maxVariants, top and probeLimit bound the work
    cachedBuckets = buildPrototypeBuckets();
  }
  return cachedBuckets;
}

/**
 * Run a scan with the library's own pipeline (generation, scoring, policy, mixed-script probes, DNS), so the site
 * and the CLI give the same answers. maxEdits is clamped to 1 to keep CPU predictable.
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
  return scan(domain, {
    resolve: options.resolve,
    resolver: options.resolve ? createDohResolver() : undefined,
    buckets: getBuckets(),
    top: Math.min(200, options.top ?? 20),
    threshold: options.threshold ?? 0,
    font: options.font,
    useMaxDanger: options.useMaxDanger,
    maxEdits: 1,
    maxVariants: 2000,
    probeLimit: 40,
  });
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
  options: { resolve?: boolean; top?: number; font?: string; threshold?: number; useMaxDanger?: boolean },
  allowFresh: () => boolean,
): Promise<ScanResult | "rate-limited"> {
  const resolve = options.resolve ?? true;
  const font = options.font ?? "";
  const cacheKey = `v14:${domain}:${resolve}:${font}`;

  // Try KV cache first (free read)
  const cached = await kv.get(cacheKey, "json") as ScanResult | null;
  if (cached) {
    return applyFilters(cached, options.threshold ?? 0, options.top ?? 20);
  }

  // Only a cache miss costs anything, so only a miss counts against the visitor's rate limit
  if (!allowFresh()) return "rate-limited";

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
      return htmlResponse(renderLandingPage(await landingData()));
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

      const result = await cachedScan(env.SCAN_CACHE, input.domain, { resolve: true, top: 50 },
        () => checkRateLimit(ip, 5));
      if (result === "rate-limited") {
        return htmlResponse("<p>Too many new scans from your connection. Try again in a minute.</p>", 429);
      }
      return htmlResponse(renderScanPage(publicResult(result)));
    }

    // GET /api/scan - Generate + score + resolve in one request
    if (path === "/api/scan") {
      const input = validateDomain(url.searchParams.get("domain") ?? "");
      if ("error" in input) {
        return jsonResponse({ error: input.error }, 400);
      }

      const resolve = url.searchParams.get("resolve") !== "false";
      const cost = resolve ? 5 : 1;

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
      }, () => checkRateLimit(ip, cost));
      if (result === "rate-limited") {
        return jsonResponse({ error: "Too many new scans from your connection. Try again in a minute." }, 429);
      }
      return jsonResponse(publicResult(result));
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
