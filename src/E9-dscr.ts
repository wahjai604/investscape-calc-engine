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
  NOIInput,
  NOIInputItemized,
  NOIResult,
  OperatingExpenseBreakdown,
  DSCRInput,
  DSCREvaluationInput,
  DSCREvaluationResult,
} from "./types";
import { MINIMUM_DSCR } from "./utils/constants";

function isItemized(input: NOIInput | NOIInputItemized): input is NOIInputItemized {
  return "operatingExpenses" in input;
}

function sumExpenseBreakdown(breakdown: OperatingExpenseBreakdown): number {
  const { insurance, propertyManagement, propertyTaxes, repairsAndMaintenance, strataOrHOA, other } = breakdown;
  return insurance + propertyManagement + propertyTaxes + repairsAndMaintenance + strataOrHOA + other;
}

export function calculateNOI(input: NOIInput | NOIInputItemized): NOIResult {
  const { grossAnnualRent, vacancyRatePercent } = input;
  const operatingExpenses = isItemized(input) ? sumExpenseBreakdown(input.operatingExpenses) : input.annualOperatingExpenses;

  const vacancyAllowance = grossAnnualRent * vacancyRatePercent;
  const netOperatingIncome = grossAnnualRent - vacancyAllowance - operatingExpenses;

  return {
    netOperatingIncome,
    operatingExpenses,
    ...(isItemized(input) ? { expenseBreakdown: input.operatingExpenses } : {}),
  };
}

export function calculateDSCR(input: DSCRInput): number {
  const { netOperatingIncome, annualDebtService } = input;
  return netOperatingIncome / annualDebtService;
}

/** NOI / purchasePrice — the unlevered return a buyer earns on the full purchase price, independent of financing. */
export function calculateCapRate(noi: number, purchasePrice: number): number {
  return noi / purchasePrice;
}

/** First-year net cash flow / equity invested — the levered cash return on the investor's actual out-of-pocket equity. */
export function calculateCashOnCash(firstYearNetCashFlow: number, equityInvested: number): number {
  return firstYearNetCashFlow / equityInvested;
}

/**
 * Lenders typically require DSCR >= 1.20 so NOI covers debt service with a
 * cushion; below that the property's own income isn't enough to safely
 * support the loan.
 */
export function evaluateDSCR(input: DSCREvaluationInput): DSCREvaluationResult {
  const { grossAnnualRent, vacancyRatePercent, annualOperatingExpenses, annualDebtService } = input;

  const { netOperatingIncome } = calculateNOI({ grossAnnualRent, vacancyRatePercent, annualOperatingExpenses });
  const dscr = calculateDSCR({ netOperatingIncome, annualDebtService });

  return {
    netOperatingIncome,
    dscr,
    meetsLenderMinimum: dscr >= MINIMUM_DSCR,
  };
}
