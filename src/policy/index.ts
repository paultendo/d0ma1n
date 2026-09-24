// Vendored from the confusable-policy workspace (not published separately): the policy layer that decides
// allow, warn, review or block for a lookalike domain.

export { createDomainPolicyEvaluator } from "./evaluator.js";
export { evaluateDomainLabel, evaluateDomainSpoof } from "./domain-policy.js";
export {
  DOMAIN_POLICY_PROFILES,
  getDomainPolicyProfile,
  getDomainPolicyProfileForTld,
  isDomainPolicyProfileName,
  listDomainPolicyProfiles,
} from "./profiles.js";
export type {
  DomainBrowserProfileName,
  DomainDecision,
  DomainDisplayMode,
  DomainLabelAssessment,
  DomainPolicyEvaluator,
  DomainPolicyProfile,
  DomainRegistryProfileName,
  DomainRiskReason,
  DomainSpoofAssessment,
  DomainSurfaces,
  EvaluateDomainLabelOptions,
  EvaluateDomainSpoofOptions,
} from "./types.js";
