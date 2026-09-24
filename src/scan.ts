import { generateMixedScriptProbes, generateVariants } from "./generate.js";
import { evaluateVariantPolicy, scoreVariants } from "./score.js";
import { buildPrototypeBuckets } from "./reverse-map.js";
import { splitDomain, getTargetTlds, tldScript } from "./tld.js";
import { getScript } from "./reverse-map.js";
import { createNodeResolver } from "./resolve.js";
import type { ScanOptions, ScanResult, DomainVariant } from "./types.js";
import { domainToASCII } from "node:url";

/** A label that IDNA refuses (for example Arabic digits inside a Latin label) cannot exist, so it is never reported. */
const canExist = (v: DomainVariant) => domainToASCII(v.domain) !== "";

/** A script-specific TLD (.рф for Cyrillic) only takes labels whose letters are all in that script. */
const fitsTld = (label: string, tld: string) => {
  const script = tldScript(tld);
  if (!script) return true;
  return [...label].every((ch) => /[0-9-]/.test(ch) || getScript(ch) === script);
};

const DECISION_PRIORITY = {
  block: 4,
  review: 3,
  warn: 2,
  allow: 1,
} as const;

function getPolicyPriority(variant: DomainVariant): number {
  if (!variant.policy) return 0;
  return DECISION_PRIORITY[variant.policy.decision];
}

function sortVariantsForTriage(a: DomainVariant, b: DomainVariant): number {
  const policyDiff = getPolicyPriority(b) - getPolicyPriority(a);
  if (policyDiff !== 0) return policyDiff;

  if (a.policy && b.policy && a.policy.score !== b.policy.score) {
    return b.policy.score - a.policy.score;
  }

  return b.dangerScore - a.dangerScore;
}

function sortResolvedVariantsForTriage(a: DomainVariant, b: DomainVariant): number {
  const aRegistered = a.dns?.registered ? 1 : 0;
  const bRegistered = b.dns?.registered ? 1 : 0;
  if (aRegistered !== bRegistered) return bRegistered - aRegistered;

  const aActive = a.dns?.threatLevel === "active" ? 1 : 0;
  const bActive = b.dns?.threatLevel === "active" ? 1 : 0;
  if (aActive !== bActive) return bActive - aActive;

  return sortVariantsForTriage(a, b);
}

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

  // Build buckets with scan options (or reuse the caller's). maxPerChar is not applied here: whole-script replacement
  // needs every letter's substitute in the target script, and generateVariants applies it to its k-edit enumeration
  const buckets = options?.buckets ?? buildPrototypeBuckets({
    includeNonPvalid: options?.includeNonPvalid,
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
      scriptMode: options?.scriptMode,
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
    const scored = scoreVariants(rawVariants.filter((r) => fitsTld(r.label, targetTld)), targetTld, {
      useMaxDanger: options?.useMaxDanger,
      font: options?.font,
      targetLabel: label,
      policy: options?.policy,
      policyProfile: options?.policyProfile,
    });
    allVariants.push(...scored);
  }

  // Filter by threshold
  allVariants = allVariants.filter((v) => v.dangerScore >= threshold && canExist(v));

  // Sort by policy severity first, then raw danger.
  allVariants.sort(sortVariantsForTriage);

  // Cap at top
  allVariants = allVariants.slice(0, top);

  // Resolve DNS if requested
  if (options?.resolve) {
    const resolver = options.resolver ?? createNodeResolver({
      concurrency: options.concurrency,
      timeout: options.timeout,
    });

    // Mixed-script lookalikes are left out of generation because browsers expose them and most registries now
    // refuse them. But some exist (registered before the rules), and a phone camera banner shows them decoded.
    // Resolve the most alike and keep only those that are registered.
    let probes: DomainVariant[] = [];
    if (options.probeMixedScript !== false && (options.scriptMode ?? "realistic") === "realistic") {
      const raw = generateMixedScriptProbes(label, buckets, {
        maxProbes: options.probeLimit,
        useMaxDanger: options.useMaxDanger,
      });
      const seen = new Set(allVariants.map((v) => v.domain));
      for (const targetTld of tlds) {
        probes.push(...scoreVariants(raw, targetTld, {
          useMaxDanger: options.useMaxDanger,
          font: options.font,
          targetLabel: label,
          policy: options.policy,
          policyProfile: options.policyProfile,
        }).filter((v) => !seen.has(v.domain) && canExist(v)));
      }
      probes = probes.sort((a, b) => b.dangerScore - a.dangerScore).slice(0, options.probeLimit ?? 60);
    }

    await Promise.all(
      [...allVariants, ...probes].map(async (v) => {
        v.dns = await resolver.resolve(v.domain);
      })
    );
    allVariants.push(...probes.filter((v) => v.dns?.registered));

    // A registered lookalike exists whatever a registry would accept today: judge it as one.
    if (options.policy !== false) {
      for (const v of allVariants) {
        if (!v.dns?.registered || !v.policy) continue;
        const { label: variantLabel, tld: variantTld } = splitDomain(v.domain);
        v.policy = evaluateVariantPolicy(variantLabel, v.substitutions, label, variantTld, {
          profileName: options.policyProfile,
          useMaxDanger: options.useMaxDanger,
          registered: true,
        });
      }
    }

    // Re-sort: registered/active first, then policy severity, then raw danger.
    allVariants.sort(sortResolvedVariantsForTriage);
  }

  return {
    original: domain,
    label,
    tld,
    totalGenerated,
    variants: allVariants,
  };
}
