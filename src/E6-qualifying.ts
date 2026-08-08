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

import { calculateMonthlyMortgagePayment } from "./E1-mortgage";
import { StressTestQualifyingInput, StressTestQualifyingResult } from "./types";
import { MINIMUM_QUALIFYING_RATE, STRESS_TEST_BUFFER, GDS_MAX_RATIO, TDS_MAX_RATIO } from "./utils/constants";

/**
 * OSFI/FCAC mortgage stress test: borrowers must qualify at the greater of
 * the 5.25% floor or their contract rate plus a 2% buffer, not at the
 * contract rate itself.
 */
export function calculateStressTestRate(contractRate: number): number {
  return Math.max(MINIMUM_QUALIFYING_RATE, contractRate + STRESS_TEST_BUFFER);
}

export function qualifyForMortgage(input: StressTestQualifyingInput): StressTestQualifyingResult {
  const {
    purchasePrice,
    downPaymentPercent,
    contractRate,
    amortizationYears,
    annualPropertyTax,
    annualHeatingCost,
    monthlyCondoFees = 0,
    otherMonthlyDebtPayments,
    grossAnnualIncome,
  } = input;

  const qualifyingRate = calculateStressTestRate(contractRate);
  const monthlyMortgagePayment = calculateMonthlyMortgagePayment({
    purchasePrice,
    downPaymentPercent,
    annualInterestRate: qualifyingRate,
    amortizationYears,
  });

  const monthlyGrossIncome = grossAnnualIncome / 12;

  // CMHC convention: only 50% of condo fees count toward GDS/TDS.
  const gdsNumerator =
    monthlyMortgagePayment + annualPropertyTax / 12 + annualHeatingCost / 12 + monthlyCondoFees * 0.5;
  const tdsNumerator = gdsNumerator + otherMonthlyDebtPayments;

  const gdsRatio = gdsNumerator / monthlyGrossIncome;
  const tdsRatio = tdsNumerator / monthlyGrossIncome;

  const gdsPass = gdsRatio <= GDS_MAX_RATIO;
  const tdsPass = tdsRatio <= TDS_MAX_RATIO;

  return {
    qualifyingRate,
    monthlyMortgagePayment,
    gdsRatio,
    tdsRatio,
    gdsPass,
    tdsPass,
    qualifies: gdsPass && tdsPass,
  };
}
