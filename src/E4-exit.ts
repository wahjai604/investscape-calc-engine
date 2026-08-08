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

import { remainingBalance } from "./E2-amortization";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./E5-returns";
import { SalePriceInput, ExitProceedsInput, ExitProceedsResult } from "./types";

export function calculateSalePrice(input: SalePriceInput): number {
  if (input.method === "flat_growth") {
    return input.originalPurchasePrice * Math.pow(1 + input.appreciationRate, input.holdPeriodYears);
  }
  return input.finalYearNOI / input.exitCapRate;
}

/**
 * Composes the exit/reversion figure that returns.ts previously took as a
 * raw exitValue input. Every piece is reused, not reimplemented:
 * calculateSalePrice() (this file) for the sale price, remainingBalance()
 * (amortization.ts, E8) for loan payoff, and buildInvestmentCashFlowSeries()
 * + calculateIRR() (returns.ts) for the full-cycle IRR — the same
 * one-series-one-solve pattern already correct in portfolio.ts. This
 * function's own consumption of exitValue-equivalent data doesn't change
 * returns.ts's buildInvestmentCashFlowSeries()/calculateIRR() at all; it
 * only supplies the number that used to be hand-entered.
 */
export function calculateExitProceeds(input: ExitProceedsInput): ExitProceedsResult {
  const salePrice =
    input.method === "flat_growth"
      ? calculateSalePrice({
          method: "flat_growth",
          originalPurchasePrice: input.originalPurchasePrice,
          appreciationRate: input.appreciationRate,
          holdPeriodYears: input.holdPeriodYears,
        })
      : calculateSalePrice({
          method: "cap_rate",
          finalYearNOI: input.projection[input.projection.length - 1].noi,
          exitCapRate: input.exitCapRate,
        });

  const sellingCosts = salePrice * input.sellingCostsRate;
  const loanPayoff = remainingBalance(input.loan, input.country, input.holdPeriodYears * 12);
  const netSaleProceeds = salePrice - sellingCosts - loanPayoff;

  const series = buildInvestmentCashFlowSeries(input.equityInvested, input.projection, netSaleProceeds);
  const fullCycleIRR = calculateIRR(series);

  return {
    salePrice,
    sellingCosts,
    remainingLoanBalance: loanPayoff,
    netSaleProceeds,
    fullCycleIRR,
  };
}
