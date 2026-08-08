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

import {
  YearlyCashFlow,
  AmortizationDisplayResult,
  DealSummary,
  ChartDataInput,
  BarChartData,
  LineChartData,
  MultiLineChartData,
  ChartData,
} from "./types";

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
