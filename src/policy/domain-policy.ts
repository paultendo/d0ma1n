import {
  detectCrossScriptRisk,
  isDomainSpoof,
  type ConfusableWeights,
  type DomainSpoofResult,
} from "namespace-guard";
import { CONFUSABLE_WEIGHTS } from "namespace-guard/confusable-weights";
import { domainToASCII } from "node:url";
import { outsideRepertoire, registryRule } from "./repertoire.js";
import { IDENTIFIER_ALLOWED } from "./identifier-status-data.js";

import { collectScripts } from "./script.js";
import { getDefaultBrowserForProfile, getDomainPolicyProfile } from "./profiles.js";
import type {
  DomainBrowserProfileName,
  DomainDecision,
  DomainDisplayMode,
  DomainLabelAssessment,
  DomainPolicyProfile,
  DomainRiskReason,
  DomainSpoofSubstitution,
  DomainSpoofAssessment,
  DomainSurfaces,
  EvaluateDomainLabelOptions,
  EvaluateDomainSpoofOptions,
} from "./types.js";

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/** Whether the label holds a character outside UTS 39's Identifier_Status=Allowed set (a small capital like ᴏ, say). */
function hasRestricted(label: string): boolean {
  for (const ch of label) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x61 && cp <= 0x7a) || (cp >= 0x30 && cp <= 0x39) || cp === 0x2d) continue;
    let lo = 0;
    let hi = IDENTIFIER_ALLOWED.length - 1;
    let allowed = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [first, last] = IDENTIFIER_ALLOWED[mid]!;
      if (cp < first) hi = mid - 1;
      else if (cp > last) lo = mid + 1;
      else { allowed = true; break; }
    }
    if (!allowed) return true;
  }
  return false;
}

function toDisplayMode(
  label: string,
  scripts: string[],
  browser: DomainBrowserProfileName,
): DomainDisplayMode {
  if (/^[a-z0-9-]+$/i.test(label)) return "ascii";
  if (browser === "unicode-all") return "unicode";
  // Chrome shows punycode for any character not allowed in identifiers (its IDN rule 3)
  if (browser === "chromium" && hasRestricted(label)) return "punycode";
  if (scripts.length <= 1) return "unicode";
  return "punycode";
}

/**
 * Each surface's display of a label. Chromium exposes as punycode a label holding a character not allowed in
 * identifiers (UTS 39 Identifier_Status, its IDN rule 3) and a whole-script lookalike of a Latin name on a generic TLD
 * (its whole-script confusable check); a phone's camera banner may decode anything.
 */
function toSurfaces(label: string, scripts: string[], wholeScriptLatinSpoof: boolean): DomainSurfaces {
  if (/^[a-z0-9-]+$/i.test(label)) {
    return { chromium: "ascii", firefox: "ascii", androidCamera: "ascii", iosCamera: "ascii" };
  }
  const mixed = scripts.length > 1;
  return {
    chromium: mixed || wholeScriptLatinSpoof || hasRestricted(label) ? "punycode" : "unicode",
    firefox: mixed ? "punycode" : "unicode",
    androidCamera: "unicode",
    iosCamera: "punycode",
  };
}

function isPvalidLike(value: string, weights: ConfusableWeights): boolean {
  for (const ch of value) {
    if (/[-0-9]/.test(ch)) continue;
    const entry = weights[ch];
    if (entry) {
      const anyTarget = Object.values(entry)[0];
      if (anyTarget?.idnaPvalid === false) return false;
      continue;
    }
  }
  return true;
}

/** Why the registry would refuse a label, for the notes shown with each variant. */
function registryRefusal(tld: string, missing: string[]): string {
  const name = `.${tld.replace(/^\./, "")}`;
  const rule = registryRule(tld);
  if (rule.kind === "tables") return `Not in the ${name} registry tables: ${[...new Set(missing)].join(" ")}.`;
  if (rule.kind === "ascii" && rule.assumed) return `The ${name} registry's rules are unchecked; assumed ASCII names only.`;
  return `The ${name} registry accepts ASCII names only.`;
}

function isRegistrableUnderProfile(
  normalizedLabel: string,
  scripts: string[],
  profile: DomainPolicyProfile,
  tld?: string,
): { registrable: boolean; notes: string[] } {
  const notes: string[] = [];

  // Where the registry's own tables are known, they decide which characters it accepts
  const missing = tld ? outsideRepertoire(normalizedLabel, tld) : undefined;
  if (missing && missing.length > 0) {
    notes.push(registryRefusal(tld!, missing));
    return { registrable: false, notes };
  }
  if (tld && missing === undefined) {
    notes.push(`The .${tld.replace(/^\./, "")} registry's character rules are unknown; judged by script only.`);
  }

  if (scripts.length === 0) {
    notes.push("ASCII-only or Common-only label.");
    return { registrable: true, notes };
  }

  if (profile.allowedScripts) {
    const unsupported = scripts.filter((script) => !profile.allowedScripts?.includes(script));
    if (unsupported.length > 0) {
      notes.push(`Scripts outside profile repertoire: ${unsupported.join(", ")}.`);
      return { registrable: false, notes };
    }
  }

  if (!profile.allowMixedScripts && scripts.length > 1) {
    notes.push("Profile assumes single-script enforcement.");
    return { registrable: false, notes };
  }

  if (profile.allowMixedScripts && scripts.length > 1) {
    notes.push("Profile allows mixed scripts for this registry family.");
  }

  if (!isPvalidLike(normalizedLabel, CONFUSABLE_WEIGHTS)) {
    notes.push("Label contains characters outside the measured PVALID-like set.");
    return { registrable: false, notes };
  }

  notes.push("Label is consistent with the profile's registrability assumptions.");
  return { registrable: true, notes };
}

function reason(code: DomainRiskReason["code"], message: string, weight: number): DomainRiskReason {
  return { code, message, weight };
}

function classify(score: number, profile: DomainPolicyProfile): DomainDecision {
  if (score >= profile.blockThreshold) return "block";
  if (score >= profile.reviewThreshold) return "review";
  if (score >= profile.warnThreshold) return "warn";
  return "allow";
}

function scoreReasons(reasons: DomainRiskReason[]): number {
  return Math.max(0, Math.min(100, reasons.reduce((sum, item) => sum + item.weight, 0)));
}

function lookupSimilarity(source: string, target: string, weights: ConfusableWeights): number | undefined {
  const direct =
    weights[source]?.[target] ??
    weights[target]?.[source] ??
    weights[source]?.[target.toUpperCase()] ??
    weights[target]?.[source.toUpperCase()] ??
    weights[source.toUpperCase()]?.[target] ??
    weights[target.toUpperCase()]?.[source];

  if (!direct) return undefined;
  return direct.stableDanger ?? direct.danger ?? (1 - direct.cost);
}

function findConfusablePath(
  label: string,
  target: string,
  weights: ConfusableWeights,
): { substitutions: DomainSpoofSubstitution[]; danger: number } | undefined {
  const labelChars = Array.from(label);
  const targetChars = Array.from(target);

  if (labelChars.length === 0 || targetChars.length === 0) return undefined;
  if (labelChars.length !== targetChars.length) return undefined;
  if (label === target) return undefined;

  const substitutions: DomainSpoofSubstitution[] = [];
  let totalDanger = 0;

  for (let i = 0; i < labelChars.length; i++) {
    const from = targetChars[i];
    const to = labelChars[i];

    if (from === to) continue;

    const similarity = lookupSimilarity(to, from, weights);
    if (similarity === undefined) return undefined;

    substitutions.push({
      index: i,
      from,
      to,
      similarity,
    });
    totalDanger += similarity;
  }

  if (substitutions.length === 0) return undefined;

  return {
    substitutions,
    danger: totalDanger / substitutions.length,
  };
}

function toObservedPath(
  substitutions: DomainSpoofSubstitution[] | undefined,
): { substitutions: DomainSpoofSubstitution[]; danger: number } | undefined {
  if (!substitutions || substitutions.length === 0) return undefined;

  return {
    substitutions,
    danger: substitutions.reduce((sum, item) => sum + item.similarity, 0) / substitutions.length,
  };
}

function buildLabelReasons(
  normalizedLabel: string,
  scripts: string[],
  displayMode: DomainDisplayMode,
  registrable: boolean,
  profile: DomainPolicyProfile,
): DomainRiskReason[] {
  const reasons: DomainRiskReason[] = [];

  if (/^[a-z0-9-]+$/i.test(normalizedLabel)) {
    reasons.push(reason("ascii-safe", "ASCII label with no Unicode spoof surface.", -12));
  }

  if (scripts.length > 1) {
    reasons.push(reason("mixed-script-label", "Label mixes scripts.", 28));
  } else if (scripts.length === 1 && scripts[0] !== "Latin") {
    reasons.push(reason("single-script-non-latin", `Single-script ${scripts[0]} label.`, 10));
  }

  if (displayMode === "punycode") {
    reasons.push(reason("displayed-as-punycode", "Browser profile would tend to show punycode here.", -10));
  } else if (displayMode === "unicode") {
    reasons.push(reason("displayed-as-unicode", "Browser profile would tend to display this label as Unicode.", 8));
  }

  if (registrable) {
    reasons.push(reason("registrable-under-profile", "Label survives the current registry profile assumptions.", 10));
  } else {
    reasons.push(reason("not-registrable-under-profile", "Label does not survive the current registry profile assumptions.", -24));
  }

  const crossScript = detectCrossScriptRisk(normalizedLabel, { weights: CONFUSABLE_WEIGHTS });
  if (crossScript.riskLevel === "high") {
    reasons.push(reason("cross-script-confusable", "Label contains high-risk cross-script confusable pairs.", 28));
  } else if (crossScript.riskLevel === "low") {
    reasons.push(reason("cross-script-confusable", "Label contains some cross-script confusable pairs.", 12));
  }

  if (!profile.allowMixedScripts && scripts.length > 1) {
    reasons.push(reason("script-not-supported", "Profile treats mixed-script labels as operational noise rather than registrable threats.", -12));
  }

  return reasons;
}

function buildSpoofReasons(
  spoofResult: DomainSpoofResult,
  confusablePath: { substitutions: DomainSpoofSubstitution[]; danger: number } | undefined,
  displayMode: DomainDisplayMode,
  registrable: boolean,
  target: string,
  context: { registered?: boolean; surfaces?: DomainSurfaces; danger?: number } = {},
): DomainRiskReason[] {
  const reasons: DomainRiskReason[] = [];
  const substitutions = spoofResult.substitutions?.length
    ? spoofResult.substitutions
    : confusablePath?.substitutions;
  const danger = context.danger ?? spoofResult.danger ?? confusablePath?.danger ?? 0;

  if (!substitutions || substitutions.length === 0) {
    reasons.push(reason("target-mismatch", `No confusable substitution path to ${target}.`, -30));
    return reasons;
  }

  if (spoofResult.spoof) {
    // A label written wholly in another script is only a spoof to the extent it looks like the target: the weight
    // scales with the measured similarity, reaching its full value at 0.5 (alike in half the text fonts).
    const weight = Math.round(46 * Math.max(0, Math.min(1, danger / 0.5)));
    reasons.push(reason("whole-script-spoof", `Single-script confusable spoof of ${target}.`, weight));
  } else {
    reasons.push(reason("confusable-match", `Measured confusable substitution path to ${target}.`, 16));
  }

  // Danger is the share of text fonts where each substitution looks alike (confusable-vision release 2): alike in half
  // of them is already strong
  if (danger >= 0.5) {
    reasons.push(reason("high-danger", `Average confusable danger ${danger.toFixed(3)}.`, 28));
  } else if (danger >= 0.2) {
    reasons.push(reason("moderate-danger", `Average confusable danger ${danger.toFixed(3)}.`, 14));
  }

  if (displayMode === "unicode") {
    reasons.push(reason("displayed-as-unicode", "Browser profile would render the spoof as Unicode.", 12));
  } else if (displayMode === "punycode") {
    reasons.push(reason("displayed-as-punycode", "Browser profile would likely expose punycode.", -14));
  }

  if (context.registered) {
    reasons.push(reason("registered", "Already registered: it exists, whatever a registry would accept today.", 30));
  } else if (registrable) {
    reasons.push(reason("registrable-under-profile", "Spoof survives current registry profile assumptions.", 10));
  } else {
    reasons.push(reason("not-registrable-under-profile", "Spoof fails current registry profile assumptions.", -26));
  }

  // A QR code hides the address; the camera's banner is where the user decides. A camera banner can show the label
  // decoded before any browser warning, so a lookalike that can exist is dangerous there even when browsers expose it.
  // Only where a browser would expose it: when browsers show it decoded anyway, the camera adds nothing new.
  if (context.surfaces?.androidCamera === "unicode" && displayMode === "punycode" && (registrable || context.registered)) {
    reasons.push(reason("decoded-by-camera", "A phone camera banner can show it decoded, before any browser warning.", 14));
  }

  return reasons;
}

export function evaluateDomainLabel(
  label: string,
  options: EvaluateDomainLabelOptions = {},
): DomainLabelAssessment {
  const profile = options.profile ?? getDomainPolicyProfile();
  const browser = getDefaultBrowserForProfile(profile, options.browser);
  const tld = options.tld ?? "com";
  const normalizedLabel = normalizeLabel(label);
  const scripts = collectScripts(normalizedLabel);
  const displayMode = toDisplayMode(normalizedLabel, scripts, browser);
  const registrability = isRegistrableUnderProfile(normalizedLabel, scripts, profile, tld);
  const reasons = buildLabelReasons(
    normalizedLabel,
    scripts,
    displayMode,
    registrability.registrable,
    profile,
  );
  const score = scoreReasons(reasons);

  return {
    kind: "label",
    label,
    tld,
    normalizedLabel,
    scripts,
    displayMode,
    registrable: registrability.registrable,
    decision: classify(score, profile),
    score,
    reasons,
    notes: [...profile.notes, ...registrability.notes],
  };
}

export function evaluateDomainSpoof(
  label: string,
  target: string,
  options: EvaluateDomainSpoofOptions = {},
): DomainSpoofAssessment {
  const profile = options.profile ?? getDomainPolicyProfile();
  const browser = getDefaultBrowserForProfile(profile, options.browser);
  const tld = options.tld ?? "com";
  const normalizedLabel = normalizeLabel(label);
  const normalizedTarget = normalizeLabel(target);
  const scripts = collectScripts(normalizedLabel);
  const displayMode = toDisplayMode(normalizedLabel, scripts, browser);
  const registrability = isRegistrableUnderProfile(normalizedLabel, scripts, profile, tld);
  const spoofResult = isDomainSpoof(normalizedLabel, normalizedTarget, {
    weights: CONFUSABLE_WEIGHTS,
    minDanger: options.minDanger ?? 0.5,
    allowlist: options.allowlist,
  });
  const observedPath = toObservedPath(options.observedSubstitutions);
  const confusablePath = observedPath ?? findConfusablePath(normalizedLabel, normalizedTarget, CONFUSABLE_WEIGHTS);
  // The caller's own measurement, when it gives one, is the similarity to judge by
  const danger = observedPath?.danger ?? spoofResult.danger ?? confusablePath?.danger ?? 0;
  const latinTarget = /^[a-z0-9-]+$/.test(normalizedTarget);
  const surfaces = toSurfaces(normalizedLabel, scripts, Boolean(spoofResult.spoof) && latinTarget);
  const shownAs = browser === "unicode-all" ? displayMode : browser === "firefox" ? surfaces.firefox : surfaces.chromium;
  const reasons = buildSpoofReasons(
    spoofResult,
    confusablePath,
    shownAs,
    registrability.registrable,
    normalizedTarget,
    { registered: options.registered, surfaces, danger },
  );
  const score = scoreReasons(reasons);

  return {
    kind: "spoof",
    label,
    target,
    tld,
    normalizedLabel,
    normalizedTarget,
    scripts,
    displayMode: shownAs,
    registrable: registrability.registrable,
    ...(options.registered === undefined ? {} : { registered: options.registered }),
    surfaces,
    decision: classify(score, profile),
    score,
    danger,
    spoof: spoofResult.spoof,
    script: spoofResult.script,
    substitutions: (
      spoofResult.substitutions?.length
        ? spoofResult.substitutions
        : confusablePath?.substitutions ?? []
    ).map((item) => ({
      index: item.index,
      from: item.from,
      to: item.to,
      similarity: item.similarity,
    })),
    reasons,
    notes: [
      ...profile.notes,
      ...registrability.notes,
      `ASCII form: ${domainToASCII(`${normalizedLabel}.${tld}`) || `${normalizedLabel}.${tld}`}.`,
    ],
  };
}
