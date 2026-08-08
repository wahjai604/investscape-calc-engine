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

export interface ScenarioAssumptions {
  /** e.g. "Base" | "Optimistic" | "Pessimistic", or any user-defined label. */
  name: string;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  appreciationRate: number;
  /** Cap rate used to value the exit (salePrice = finalYearNOI / exitCapRate). null uses flat appreciationRate compounding instead. */
  exitCapRate: number | null;
}

export interface ScenarioInput {
  baseDeal: DealParameters;
  scenarios: ScenarioAssumptions[];
  holdPeriodYears: number;
  /** Defaults to 0. e.g. 0.06 for a 6% realtor commission, applied uniformly to every scenario's projectedSalePrice. */
  sellingCostsPercent?: number;
}

export interface ScenarioOutcome {
  name: string;
  projectedSalePrice: number;
  /** projectedSalePrice - remaining loan balance at exit. Gross of selling costs — ScenarioInput has no sellingCostsRate field (unlike exit.ts's calculateExitProceeds()). */
  projectedEquity: number;
  /** Sum of netCashFlow across every year of the hold period (operating cash flow only, before the exit/sale). */
  cumulativeCashFlow: number;
  /** Full-cycle IRR: -equityInvested at year 0, each year's netCashFlow, plus projectedEquity added to the final year. */
  irr: number;
  /** Year 1 netCashFlow / equityInvested. Note: year 1 is unaffected by rentGrowthRate/expenseGrowthRate (cashflow.ts only compounds growth starting year 2), so this is identical across scenarios that share the same baseDeal — it's appreciationRate/exitCapRate/cumulative growth that actually differentiate scenarios, not year-1 cash-on-cash. */
  cashOnCash: number;
  summary: string;
  /** The sellingCostsPercent this outcome was computed with (echoes ScenarioInput.sellingCostsPercent, defaulted to 0 if omitted). */
  sellingCostsPercent: number;
  /** projectedEquity - (projectedSalePrice × sellingCostsPercent). null when sellingCostsPercent is 0 — there's nothing to net out, and null (vs. 0) keeps "not modeled" distinguishable from "modeled and it's zero". */
  projectedEquityNetOfSellingCosts: number | null;
  /** Explains whether selling costs were deducted, and prompts for a realistic rate if not. */
  warning: string;
}

export interface ScenarioComparisonResult {
  scenarios: ScenarioOutcome[];
  /** Name of the scenario with the highest IRR. */
  bestCase: string;
  /** Name of the scenario with the lowest IRR. */
  worstCase: string;
  /** "All scenarios positive" | "Mixed results" | "All scenarios negative", based on each scenario's IRR sign. */
  recommendation: string;
}
