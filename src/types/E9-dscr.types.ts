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
