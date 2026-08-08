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

import { MortgageInput, MortgageCountry, YearlyCashFlow } from "./common.types";

/**
 * Standalone, independently-testable sale-price calculation. Method is an
 * explicit discriminator (not a boolean) so there's no ambiguous default.
 */
export type SalePriceInput =
  | { method: "flat_growth"; originalPurchasePrice: number; appreciationRate: number; holdPeriodYears: number }
  | { method: "cap_rate"; finalYearNOI: number; exitCapRate: number };

interface ExitProceedsInputBase {
  sellingCostsRate: number;
  loan: MortgageInput;
  country: MortgageCountry;
  holdPeriodYears: number;
  equityInvested: number;
  /** E9's projectCashFlows() output, passed in already-built — not reconstructed here. */
  projection: YearlyCashFlow[];
}

export type ExitProceedsInput =
  | (ExitProceedsInputBase & { method: "flat_growth"; originalPurchasePrice: number; appreciationRate: number })
  | (ExitProceedsInputBase & { method: "cap_rate"; exitCapRate: number });

export interface ExitProceedsResult {
  salePrice: number;
  sellingCosts: number;
  remainingLoanBalance: number;
  netSaleProceeds: number;
  fullCycleIRR: number;
}
