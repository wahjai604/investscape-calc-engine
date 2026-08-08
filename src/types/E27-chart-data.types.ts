import { YearlyCashFlow } from "./common.types";
import { AmortizationDisplayResult } from "./E26-amortization-display.types";

export interface DealSummary {
  purchasePrice: number;
  downPaymentPercent: number;
  /** Typically 5. Drives both the number of annual bars and the 0..holdPeriodYears*12 range of the monthly cumulative line. */
  holdPeriodYears: number;
}

export interface ChartDataInput {
  deal: DealSummary;
  /**
   * Yearly rows from cashflow.ts's projectCashFlows() (or an equivalent
   * synthetic array of { year, netCashFlow } objects — NOI minus debt
   * service per year). This module has no monthly cash flow source of its
   * own, so monthly figures below are derived by splitting each year's
   * netCashFlow evenly across its 12 months.
   */
  cashflowSchedule: YearlyCashFlow[];
  amortizationDisplayResult: AmortizationDisplayResult;
  /** Down payment + closing costs — the initial equity outflow the monthly cumulative line starts from (as a negative). */
  equityInvested: number;
}

export interface BarChartData {
  year: number;
  /** This year's netCashFlow expressed as a monthly rate (netCashFlow / 12), e.g. for a "+$4,200/month" style label. */
  monthly_cf: number;
  /** Running total of full annual netCashFlow from year 1 through this year (does not include equityInvested). */
  cumulative_cf: number;
  color: string;
}

export interface LineChartData {
  month: number;
  cumulative_cf: number;
}

export interface MultiLineChartData {
  tranche_id: string;
  type: string;
  color: string;
  points: { month: number; balance: number }[];
}

export interface ChartData {
  annualBars: BarChartData[];
  monthlyCumulativeLine: LineChartData[];
  multiTrancheLine: MultiLineChartData[];
}
