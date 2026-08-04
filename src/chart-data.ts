import { YearlyCashFlow } from "./cashflow";
import { AmortizationDisplayResult } from "./amortization-display";

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

function colorForCashFlow(netCashFlow: number): string {
  if (netCashFlow > 0) return "green";
  if (netCashFlow < 0) return "red";
  return "gray";
}

/** One bar per year in cashflowSchedule: that year's monthly rate, plus the running total of annual cash flow since purchase. */
export function generateAnnualCFBars(
  _deal: DealSummary,
  cashflowSchedule: YearlyCashFlow[],
  _equityInvested: number,
): BarChartData[] {
  let cumulative = 0;

  return cashflowSchedule.map((row) => {
    cumulative += row.netCashFlow;

    return {
      year: row.year,
      monthly_cf: row.netCashFlow / 12,
      cumulative_cf: cumulative,
      color: colorForCashFlow(row.netCashFlow),
    };
  });
}

/**
 * Month 0 is the purchase date, seeded at -equityInvested. Each subsequent
 * month adds that month's share of its year's netCashFlow (netCashFlow / 12,
 * per the derivation note on ChartDataInput.cashflowSchedule), running
 * through deal.holdPeriodYears * 12.
 */
export function generateMonthlyCumulativeLine(
  deal: DealSummary,
  cashflowSchedule: YearlyCashFlow[],
  equityInvested: number,
): LineChartData[] {
  const totalMonths = deal.holdPeriodYears * 12;
  const line: LineChartData[] = [{ month: 0, cumulative_cf: -equityInvested }];

  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);
    const yearRow = cashflowSchedule[year - 1];
    const monthlyCF = yearRow ? yearRow.netCashFlow / 12 : 0;

    line.push({ month, cumulative_cf: line[line.length - 1].cumulative_cf + monthlyCF });
  }

  return line;
}

/**
 * Each tranche's E14 monthly_rows already carry global month + ending
 * balance; the (drawDate_month, loanAmount) starting point the spec calls
 * for isn't stored directly on TrancheSchedule, so it's recovered from the
 * first row instead: that row's beginning_balance is the original
 * loanAmount, one month before its own (month) value.
 */
export function generateMultiTrancheLine(amortizationDisplayResult: AmortizationDisplayResult): MultiLineChartData[] {
  return amortizationDisplayResult.tranche_schedules.map((schedule) => {
    const points: { month: number; balance: number }[] = [];

    if (schedule.monthly_rows.length > 0) {
      const firstRow = schedule.monthly_rows[0];
      points.push({ month: firstRow.month - 1, balance: firstRow.beginning_balance });
    }

    for (const row of schedule.monthly_rows) {
      points.push({ month: row.month, balance: row.ending_balance });
    }

    return {
      tranche_id: schedule.tranche_id,
      type: schedule.type,
      color: schedule.color,
      points,
    };
  });
}

export function generateChartData(input: ChartDataInput): ChartData {
  return {
    annualBars: generateAnnualCFBars(input.deal, input.cashflowSchedule, input.equityInvested),
    monthlyCumulativeLine: generateMonthlyCumulativeLine(input.deal, input.cashflowSchedule, input.equityInvested),
    multiTrancheLine: generateMultiTrancheLine(input.amortizationDisplayResult),
  };
}
