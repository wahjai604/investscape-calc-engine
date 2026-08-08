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

import {
  InsurancePropertyType,
  InsuranceCountry,
  InsuranceEstimationInput,
  InsuranceBreakdown,
  InsuranceEstimationResult,
} from "./types";
import { DWELLING_SHARE_OF_COMBINED_RATE, LIABILITY_SHARE_OF_COMBINED_RATE } from "./utils/constants";

interface RateRange {
  min: number;
  max: number;
}

/**
 * Rates are the midpoint of each range the E27 spec gives — confirmed by
 * cross-checking against the spec's own test cases: SFH Canada (0.4-0.6%
 * → 0.5%), SFH US (0.5-0.8% → 0.65%), Multifamily Canada (0.6-0.9% →
 * 0.75%), and Commercial US (1.2-1.6% → 1.4%) all match their midpoint
 * exactly in the worked examples.
 */
const CANADA_RATES: Record<InsurancePropertyType, RateRange> = {
  sfh: { min: 0.004, max: 0.006 },
  duplex: { min: 0.005, max: 0.007 },
  multifamily: { min: 0.006, max: 0.009 },
  commercial: { min: 0.008, max: 0.012 },
};

const US_RATES: Record<InsurancePropertyType, RateRange> = {
  sfh: { min: 0.005, max: 0.008 },
  duplex: { min: 0.007, max: 0.01 },
  multifamily: { min: 0.009, max: 0.013 },
  commercial: { min: 0.012, max: 0.016 },
};

function baseRateFor(country: InsuranceCountry, propertyType: InsurancePropertyType): number {
  const range = (country === "Canada" ? CANADA_RATES : US_RATES)[propertyType];
  return (range.min + range.max) / 2;
}

/**
 * A relative (multiplicative) adjustment to the base rate, not a flat
 * percentage-point add/subtract — confirmed by the spec's own worked
 * examples: "0.5% - 10% = 0.45%" is only correct as 0.5% × (1 - 0.10) =
 * 0.45%; literal point-subtraction (0.5% - 10%) would be nonsensical
 * (-9.5%). Likewise "0.5% + 30% = 0.65%" only works as 0.5% × 1.30 =
 * 0.65% (point-addition would give 0.80%, not 0.65%).
 *
 * This adjustment applies to CANADA ONLY. It's written in the spec
 * directly beneath the Canada rate table and before the USA table begins
 * — and decisively, the Commercial USA test case (a 25-year-old building,
 * which would fall in the "20-40 years: +15%" bracket) shows NO
 * adjustment applied (1.4% flat, not 1.4% × 1.15 = 1.61%). So this is
 * read as Canada-specific, not a rule that also applies to the US.
 */
function canadaAgeAdjustmentFactor(buildingAgeYears: number): number {
  if (buildingAgeYears < 5) return -0.1;
  if (buildingAgeYears < 20) return 0;
  if (buildingAgeYears < 40) return 0.15;
  return 0.3;
}

/**
 * The spec's PMI table only starts at "LTV 85-89%: 0.55%", leaving no
 * rate for LTV strictly between 80% (the "> 80%" PMI-required floor) and
 * 85% — a realistic, common range in practice. Rather than invent a new
 * number, that gap is filled by extending the lowest given bracket's rate
 * (0.55%) down to the 80% floor.
 */
function pmiPercentForLTV(loanToValuePercent: number): number {
  if (loanToValuePercent >= 0.95) return 0.012;
  if (loanToValuePercent >= 0.9) return 0.008;
  return 0.0055;
}

/**
 * Neither Canada's "(dwelling + liability combined)" description nor the
 * US table's "(dwelling)"-only label give an explicit dwelling/liability
 * split — the US total is nonetheless treated as combined too (matching
 * how the SFH US test case computes 0.65% as the complete
 * estimatedAnnualInsurance figure, with no separate liability add-on).
 * This is a documented, illustrative split of that combined rate — not a
 * figure given anywhere in the E27 spec.
 */
export function calculateInsuranceEstimation(input: InsuranceEstimationInput): InsuranceEstimationResult {
  const baseRate = baseRateFor(input.country, input.propertyType);
  const ageAdjustment = input.country === "Canada" ? canadaAgeAdjustmentFactor(input.buildingAgeYears) : 0;
  const insuranceRatePercent = baseRate * (1 + ageAdjustment);

  const estimatedAnnualInsurance = input.propertyValue * insuranceRatePercent;
  const estimatedMonthlyInsurance = estimatedAnnualInsurance / 12;

  const pmiRequired = input.country === "US" && input.loanToValuePercent > 0.8;
  const pmiPercent = pmiRequired ? pmiPercentForLTV(input.loanToValuePercent) : null;
  const estimatedAnnualPMI = pmiPercent !== null ? input.propertyValue * input.loanToValuePercent * pmiPercent : null;

  const totalAnnualInsurance = estimatedAnnualInsurance + (estimatedAnnualPMI ?? 0);

  const insuranceBreakdown: InsuranceBreakdown = {
    dwelling_insurance_percent: insuranceRatePercent * DWELLING_SHARE_OF_COMBINED_RATE,
    liability_insurance_percent: insuranceRatePercent * LIABILITY_SHARE_OF_COMBINED_RATE,
    pmi_percent: pmiPercent,
  };

  const summary =
    `Property insurance: $${estimatedAnnualInsurance.toFixed(2)}/year. ` +
    `PMI (if applicable): $${(estimatedAnnualPMI ?? 0).toFixed(2)}/year. ` +
    `Total: $${totalAnnualInsurance.toFixed(2)}/year.`;

  return {
    propertyValue: input.propertyValue,
    estimatedAnnualInsurance,
    estimatedMonthlyInsurance,
    insuranceRatePercent,
    pmiRequired,
    estimatedAnnualPMI,
    totalAnnualInsurance,
    insuranceBreakdown,
    summary,
    disclaimer: "Insurance rates vary by property condition, claims history, and underwriting. This is an estimate.",
  };
}
