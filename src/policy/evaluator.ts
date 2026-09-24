import { evaluateDomainLabel, evaluateDomainSpoof } from "./domain-policy.js";
import type {
  DomainPolicyEvaluator,
  DomainPolicyProfile,
  EvaluateDomainLabelOptions,
  EvaluateDomainSpoofOptions,
} from "./types.js";

type LabelOverrides = Omit<EvaluateDomainLabelOptions, "profile">;
type SpoofOverrides = Omit<EvaluateDomainSpoofOptions, "profile">;

export function createDomainPolicyEvaluator(profile: DomainPolicyProfile): DomainPolicyEvaluator {
  return {
    profile,
    evaluateLabel(label: string, options: LabelOverrides = {}) {
      return evaluateDomainLabel(label, {
        ...options,
        profile,
      });
    },
    evaluateSpoof(label: string, target: string, options: SpoofOverrides = {}) {
      return evaluateDomainSpoof(label, target, {
        ...options,
        profile,
      });
    },
  };
}
