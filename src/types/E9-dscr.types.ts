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

export interface NOIInput {
  grossAnnualRent: number;
  vacancyRatePercent: number;
  annualOperatingExpenses: number;
}

/** Itemized breakdown of annual operating expenses; calculateNOI() sums these in place of a lump-sum annualOperatingExpenses figure. */
export interface OperatingExpenseBreakdown {
  insurance: number;
  propertyManagement: number;
  propertyTaxes: number;
  repairsAndMaintenance: number;
  strataOrHOA: number;
  other: number;
}

/** Alternate calculateNOI() input shape: same as NOIInput but with operatingExpenses itemized instead of a lump sum. */
export interface NOIInputItemized {
  grossAnnualRent: number;
  vacancyRatePercent: number;
  operatingExpenses: OperatingExpenseBreakdown;
}

export interface NOIResult {
  netOperatingIncome: number;
  /** Total annual operating expenses used in the calculation (the lump sum, or the sum of expenseBreakdown when itemized). */
  operatingExpenses: number;
  /** Present only when calculateNOI() was called with NOIInputItemized, so a caller can render the per-category figures. */
  expenseBreakdown?: OperatingExpenseBreakdown;
}

export interface DSCRInput {
  netOperatingIncome: number;
  annualDebtService: number;
}

export interface DSCREvaluationInput extends NOIInput {
  annualDebtService: number;
}

export interface DSCREvaluationResult {
  netOperatingIncome: number;
  dscr: number;
  meetsLenderMinimum: boolean;
}
