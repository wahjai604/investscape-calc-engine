import { MortgageInput } from "./mortgage";
import { MortgageCountry, remainingBalance } from "./amortization";
import { YearlyCashFlow } from "./cashflow";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./returns";

/**
 * Standalone, independently-testable sale-price calculation. Method is an
 * explicit discriminator (not a boolean) so there's no ambiguous default.
 */
export type SalePriceInput =
  | { method: "flat_growth"; originalPurchasePrice: number; appreciationRate: number; holdPeriodYears: number }
  | { method: "cap_rate"; finalYearNOI: number; exitCapRate: number };

export function calculateSalePrice(input: SalePriceInput): number {
  if (input.method === "flat_growth") {
    return input.originalPurchasePrice * Math.pow(1 + input.appreciationRate, input.holdPeriodYears);
  }
  return input.finalYearNOI / input.exitCapRate;
}

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
