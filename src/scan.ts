import { generateVariants } from "./generate.js";
import { scoreVariants } from "./score.js";
import { buildPrototypeBuckets } from "./reverse-map.js";
import { splitDomain, getTargetTlds } from "./tld.js";
import { createNodeResolver } from "./resolve.js";
import type { ScanOptions, ScanResult, DomainVariant } from "./types.js";

/**
 * Run a full domain spoofing scan.
 *
 * Pipeline: generate variants -> score -> optionally resolve DNS -> sort/filter.
 */
export async function scan(
  domain: string,
  options?: ScanOptions
): Promise<ScanResult> {
  const { label, tld } = splitDomain(domain);
  const top = options?.top ?? 20;
  const threshold = options?.threshold ?? 0.0;

  // Build buckets with scan options
  const buckets = buildPrototypeBuckets({
    includeNonPvalid: options?.includeNonPvalid,
    maxPerChar: options?.maxPerChar,
    useMaxDanger: options?.useMaxDanger,
  });

  // Generate raw variants for the label
  const rawVariants = generateVariants(
    label,
    {
      maxEdits: options?.maxEdits,
      maxPerChar: options?.maxPerChar,
      maxVariants: options?.maxVariants,
      includeNonPvalid: options?.includeNonPvalid,
      useMaxDanger: options?.useMaxDanger,
    },
    buckets
  );

  const totalGenerated = rawVariants.length;

  // Determine TLDs to check
  const scripts = new Set<string>();
  for (const v of rawVariants) {
    for (const s of v.substitutions) {
      scripts.add(s.script);
    }
  }

  const tlds = getTargetTlds({
    baseTlds: options?.tlds ?? [tld],
    tldVariants: options?.tldVariants,
    scripts,
  });

  // Score variants across all target TLDs
  let allVariants: DomainVariant[] = [];
  for (const targetTld of tlds) {
    const scored = scoreVariants(rawVariants, targetTld, {
      useMaxDanger: options?.useMaxDanger,
      font: options?.font,
    });
    allVariants.push(...scored);
  }

  // Filter by threshold
  allVariants = allVariants.filter((v) => v.dangerScore >= threshold);

  // Sort by danger score descending
  allVariants.sort((a, b) => b.dangerScore - a.dangerScore);

  // Cap at top
  allVariants = allVariants.slice(0, top);

  // Resolve DNS if requested
  if (options?.resolve) {
    const resolver = createNodeResolver({
      concurrency: options.concurrency,
      timeout: options.timeout,
    });

    await Promise.all(
      allVariants.map(async (v) => {
        v.dns = await resolver.resolve(v.domain);
      })
    );

    // Re-sort: registered domains first, then by danger score
    allVariants.sort((a, b) => {
      const aRegistered = a.dns?.registered ? 1 : 0;
      const bRegistered = b.dns?.registered ? 1 : 0;
      if (aRegistered !== bRegistered) return bRegistered - aRegistered;

      // Active threats first among registered
      const aActive = a.dns?.threatLevel === "active" ? 1 : 0;
      const bActive = b.dns?.threatLevel === "active" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      return b.dangerScore - a.dangerScore;
    });
  }

  return {
    original: domain,
    label,
    tld,
    totalGenerated,
    variants: allVariants,
  };
}
