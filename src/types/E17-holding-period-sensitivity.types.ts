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

import { DealParameters } from "./common.types";

export interface HoldingPeriodSensitivityInput {
  /** Same shape as scenario.ts's DealParameters — full financing + operating metrics, held constant across every hold period tested. */
  baseDeal: DealParameters;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  appreciationRate: number;
  /** Cap rate used to value the exit at every hold length (salePrice = finalYearNOI / exitCapRate). null uses flat appreciationRate compounding instead. */
  exitCapRate: number | null;
  /** Defaults to 0. e.g. 0.06 for a 6% realtor commission, applied uniformly at every hold length. */
  sellingCostsPercent?: number;
}

export interface HoldPeriodOutcome {
  holdYears: number;
  /** Sum of netCashFlow across every year of this hold period (operating cash flow only, before the exit/sale). */
  cumulativeCashFlow: number;
  /** projectedSalePrice - remaining loan balance at this hold length. Gross of selling costs. */
  projectedEquity: number;
  /** projectedEquity - (projectedSalePrice × sellingCostsPercent). null when sellingCostsPercent is 0. */
  projectedEquityNetOfSellingCosts: number | null;
  /** Full-cycle IRR for exiting at this hold length: -equityInvested at year 0, each year's netCashFlow, plus (gross) projectedEquity added to the final year. */
  irr: number;
  /** Year 1 netCashFlow / equityInvested. Identical across every hold length here, since rentGrowthRate/expenseGrowthRate are fixed inputs shared by all of them (not per-hold-period assumptions). */
  cashOnCash: number;
  /** This hold length's final-year NOI divided by its own projected sale price (property value at exit), not a fixed purchase-price-based cap rate. */
  capRate: number;
}

export interface HoldingPeriodSensitivityResult {
  /** One entry per hold length from 1 to 30 years. */
  holdPeriodAnalysis: HoldPeriodOutcome[];
  /** The holdYears value (not an array index) with the highest IRR. */
  bestHoldPeriodByIRR: number;
  irr_at_5_years: number;
  irr_at_10_years: number;
  /** First holdYears (1-30) where cumulativeCashFlow >= baseDeal.equityInvested. null if that never happens within 30 years. */
  breakEvenYear: number | null;
}
