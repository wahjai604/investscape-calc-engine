import { IRR, MIRR } from "@formulajs/formulajs";
import { YearlyCashFlow } from "./types";

/**
 * Builds the year-0..n series IRR/MIRR expect: a negative acquisition cost
 * (equity invested) at year 0, each year's net cash flow after debt
 * service, with the exit/reversion value added onto the final year.
 */
export function buildInvestmentCashFlowSeries(
  equityInvested: number,
  annualCashFlows: YearlyCashFlow[],
  exitValue: number
): number[] {
  const netCashFlows = annualCashFlows.map((cf) => cf.netCashFlow);
  netCashFlows[netCashFlows.length - 1] += exitValue;
  return [-equityInvested, ...netCashFlows];
}

export function calculateIRR(cashFlowSeries: number[], guess = 0.1): number {
  return IRR(cashFlowSeries, guess) as number;
}

export function calculateMIRR(cashFlowSeries: number[], financeRate: number, reinvestRate: number): number {
  return MIRR(cashFlowSeries, financeRate, reinvestRate) as number;
}

export function calculateEquityMultiple(equityInvested: number, cashFlowSeries: number[]): number {
  const totalCashReturned = cashFlowSeries.slice(1).reduce((sum, cf) => sum + cf, 0);
  return totalCashReturned / equityInvested;
}
