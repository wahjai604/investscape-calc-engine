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

import { FHAMIPInput, FHAMIPResult } from "./types";
import {
  FHA_ANNUAL_MIP_TIERS,
  FHA_MIP_AUTOMATIC_REMOVAL_YEARS,
  FHA_MIP_ELEVEN_YEAR_REMOVAL_MIN_DOWN_PAYMENT,
  FHA_UFMIP_RATE,
  US_CONFORMING_LOAN_LIMIT_HIGH_COST,
  US_CONFORMING_LOAN_LIMIT_STANDARD,
} from "./utils/constants";

/**
 * Four real branches, not one flat rate: loan term (15 vs. 30yr) AND down
 * payment tier AND whether the loan exceeds the applicable conforming
 * limit. See docs/US-QUALIFIER-SOURCES.md for how FHA_ANNUAL_MIP_TIERS'
 * numbers were composed from the sourced 0.55%/0.50%/0.75%/0.15% range.
 */
export function calculateFHAAnnualMIPRate(input: {
  loanAmount: number;
  downPaymentPercent: number;
  amortizationYears: number;
  isHighCostArea: boolean;
}): number {
  const { loanAmount, downPaymentPercent, amortizationYears, isHighCostArea } = input;

  const isFifteenYearTerm = amortizationYears <= 15;
  const termTier = isFifteenYearTerm
    ? FHA_ANNUAL_MIP_TIERS.fifteenYear
    : FHA_ANNUAL_MIP_TIERS.thirtyYear;
  const highLTVThreshold = isFifteenYearTerm ? 0.1 : 0.05;

  const baseRate =
    downPaymentPercent < highLTVThreshold ? termTier.highLTVRate : termTier.lowLTVRate;

  const applicableLimit = isHighCostArea
    ? US_CONFORMING_LOAN_LIMIT_HIGH_COST
    : US_CONFORMING_LOAN_LIMIT_STANDARD;
  const exceedsConformingLimit = loanAmount > applicableLimit;

  return exceedsConformingLimit
    ? baseRate + FHA_ANNUAL_MIP_TIERS.aboveConformingLimitSurcharge
    : baseRate;
}

export function calculateFHAMIP(input: FHAMIPInput): FHAMIPResult {
  const { loanAmount, downPaymentPercent, amortizationYears, isHighCostArea } = input;

  const upfrontMIPRate = FHA_UFMIP_RATE;
  const upfrontMIPAmount = loanAmount * upfrontMIPRate;

  const annualMIPRate = calculateFHAAnnualMIPRate({
    loanAmount,
    downPaymentPercent,
    amortizationYears,
    isHighCostArea,
  });
  const annualMIPAmount = loanAmount * annualMIPRate;
  const monthlyMIPAmount = annualMIPAmount / 12;

  const automaticRemovalEligible =
    downPaymentPercent >= FHA_MIP_ELEVEN_YEAR_REMOVAL_MIN_DOWN_PAYMENT;

  return {
    upfrontMIPRate,
    upfrontMIPAmount,
    annualMIPRate,
    annualMIPAmount,
    monthlyMIPAmount,
    automaticRemovalEligible,
    automaticRemovalAfterYears: automaticRemovalEligible ? FHA_MIP_AUTOMATIC_REMOVAL_YEARS : null,
    isLifeOfLoan: !automaticRemovalEligible,
    issues: [],
  };
}
