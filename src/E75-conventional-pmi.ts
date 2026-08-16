/**
 * InvestScape™ Calculation Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: eric@lighthouseresearch.ca
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

import { ConventionalPMIInput, ConventionalPMIResult } from "./types";
import {
  PMI_CREDIT_SCORE_MULTIPLIERS,
  PMI_LTV_TIERS,
  PMI_RATE_CEILING,
  PMI_RATE_FLOOR,
  PMI_REQUIRED_LTV_THRESHOLD,
} from "./utils/constants";

function pmiBaseRateForLTV(loanToValuePercent: number): number {
  const tier = PMI_LTV_TIERS.find((t) => loanToValuePercent <= t.maxLTV);
  // Above the highest named LTV tier (97%) — conventional PMI generally
  // isn't available above 97% LTV at all, so this falls back to the
  // steepest tier rather than leaving the rate undefined.
  return tier ? tier.baseRate : PMI_LTV_TIERS[PMI_LTV_TIERS.length - 1].baseRate;
}

function pmiCreditScoreMultiplier(creditScore: number): number {
  const tier = PMI_CREDIT_SCORE_MULTIPLIERS.find((t) => creditScore >= t.minScore);
  return tier ? tier.multiplier : PMI_CREDIT_SCORE_MULTIPLIERS[PMI_CREDIT_SCORE_MULTIPLIERS.length - 1].multiplier;
}

/**
 * Driven by LTV and credit score, not a flat guess — clamped to the
 * sourced 0.3%-1.5%/year range at the extremes. See
 * docs/US-QUALIFIER-SOURCES.md for how the tier tables were composed.
 */
export function calculatePMIRate(loanToValuePercent: number, creditScore: number): number {
  const baseRate = pmiBaseRateForLTV(loanToValuePercent);
  const multiplier = pmiCreditScoreMultiplier(creditScore);
  const rawRate = baseRate * multiplier;

  return Math.min(PMI_RATE_CEILING, Math.max(PMI_RATE_FLOOR, rawRate));
}

export function calculateConventionalPMI(input: ConventionalPMIInput): ConventionalPMIResult {
  const { loanAmount, downPaymentPercent, creditScore } = input;

  const loanToValuePercent = 1 - downPaymentPercent;
  const pmiRequired = loanToValuePercent > PMI_REQUIRED_LTV_THRESHOLD;

  // A real zero, not an omitted/null field, whenever PMI isn't required.
  const annualPMIRate = pmiRequired ? calculatePMIRate(loanToValuePercent, creditScore) : 0;
  const annualPMIAmount = loanAmount * annualPMIRate;
  const monthlyPMIAmount = annualPMIAmount / 12;

  return {
    loanToValuePercent,
    pmiRequired,
    annualPMIRate,
    annualPMIAmount,
    monthlyPMIAmount,
    cancellableAtLTV: PMI_REQUIRED_LTV_THRESHOLD,
    issues: [],
  };
}
