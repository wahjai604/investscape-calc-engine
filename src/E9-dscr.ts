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

import { NOIInput, DSCRInput, DSCREvaluationInput, DSCREvaluationResult } from "./types";
import { MINIMUM_DSCR } from "./utils/constants";

export function calculateNOI(input: NOIInput): number {
  const { grossAnnualRent, vacancyRatePercent, annualOperatingExpenses } = input;

  const vacancyAllowance = grossAnnualRent * vacancyRatePercent;
  return grossAnnualRent - vacancyAllowance - annualOperatingExpenses;
}

export function calculateDSCR(input: DSCRInput): number {
  const { netOperatingIncome, annualDebtService } = input;
  return netOperatingIncome / annualDebtService;
}

/**
 * Lenders typically require DSCR >= 1.20 so NOI covers debt service with a
 * cushion; below that the property's own income isn't enough to safely
 * support the loan.
 */
export function evaluateDSCR(input: DSCREvaluationInput): DSCREvaluationResult {
  const { grossAnnualRent, vacancyRatePercent, annualOperatingExpenses, annualDebtService } = input;

  const netOperatingIncome = calculateNOI({ grossAnnualRent, vacancyRatePercent, annualOperatingExpenses });
  const dscr = calculateDSCR({ netOperatingIncome, annualDebtService });

  return {
    netOperatingIncome,
    dscr,
    meetsLenderMinimum: dscr >= MINIMUM_DSCR,
  };
}
