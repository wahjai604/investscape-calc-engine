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

import { calculateCapitalStack } from "./E8-capitalstack";
import { trancheAmortizationSchedule, buildPresaleDepositSchedule } from "./E2-amortization";
import {
  FinancingFacility,
  FinancingTableInput,
  FinancingTableResult,
  FacilitySummary,
  FacilityInterestReserveRow,
  CombinedPeriodRow,
} from "./types";

interface PeriodBalanceAndInterest {
  balance: number;
  interestAccrued: number;
}

/**
 * Per-period (balance, interestAccrued) for one facility, truncated/padded
 * to `months`. senior_debt/mezzanine run their own P&I schedule
 * (trancheAmortizationSchedule) and sit at a $0 balance once it's shorter
 * than months; presale_deposit runs its distinct draw/bullet-repayment
 * schedule (buildPresaleDepositSchedule) sized to months directly; equity
 * carries no schedule at all.
 */
function facilityPeriods(facility: FinancingFacility, months: number): PeriodBalanceAndInterest[] {
  if (facility.type === "equity") {
    return [];
  }

  if (facility.type === "presale_deposit") {
    const rows = buildPresaleDepositSchedule(facility, months);
    return rows.map((row) => ({ balance: row.drawnBalance, interestAccrued: row.interestAccrued }));
  }

  const rows = trancheAmortizationSchedule(facility, "monthly");
  const periods: PeriodBalanceAndInterest[] = [];
  for (let period = 1; period <= months; period++) {
    const row = rows[period - 1];
    periods.push(row ? { balance: row.endingBalance, interestAccrued: row.interest } : { balance: 0, interestAccrued: 0 });
  }
  return periods;
}

function buildInterestReserveSchedule(
  periods: PeriodBalanceAndInterest[],
  interestReserveAmount: number,
): FacilityInterestReserveRow[] {
  if (interestReserveAmount <= 0) {
    return [];
  }

  const rows: FacilityInterestReserveRow[] = [];
  let cumulativeInterest = 0;

  for (const { interestAccrued } of periods) {
    cumulativeInterest += interestAccrued;
    const reserveBalance = Math.max(0, interestReserveAmount - cumulativeInterest);

    rows.push({
      period: rows.length + 1,
      interestAccrued,
      reserveBalance,
      reserveDepleted: reserveBalance <= 0,
    });
  }

  return rows;
}

/**
 * Combines calculateCapitalStack() (sources, weights, commitment
 * fees/net advances) with trancheAmortizationSchedule() /
 * buildPresaleDepositSchedule() (each facility's own balance-over-time
 * mechanic) into one result: total sources, per-facility interest reserve
 * draw-down, and a period-by-period combined balance series ready for a
 * stacked area/line chart.
 */
export function calculateFinancingTable(input: FinancingTableInput): FinancingTableResult {
  const { facilities, taxRate, months } = input;

  const capitalStack = calculateCapitalStack(
    facilities.map(({ id, ...tranche }) => tranche),
    taxRate,
  );

  const facilityPeriodsById = new Map<string, PeriodBalanceAndInterest[]>();

  const summaries: FacilitySummary[] = facilities.map((facility) => {
    const periods = facilityPeriods(facility, months);
    facilityPeriodsById.set(facility.id, periods);

    const commitmentFeeAmount = facility.amount * (facility.commitmentFeePercent ?? 0);
    const interestReserveAmount = facility.interestReserveAmount ?? 0;

    return {
      id: facility.id,
      type: facility.type,
      amount: facility.amount,
      commitmentFeeAmount,
      netAdvance: facility.amount - interestReserveAmount - commitmentFeeAmount,
      interestReserveAmount,
      interestReserveSchedule: buildInterestReserveSchedule(periods, interestReserveAmount),
    };
  });

  const combinedSeries: CombinedPeriodRow[] = [];
  for (let period = 1; period <= months; period++) {
    const balancesByFacility: Record<string, number> = {};
    let totalOutstanding = 0;

    for (const facility of facilities) {
      const periods = facilityPeriodsById.get(facility.id)!;
      const balance = periods[period - 1]?.balance ?? 0;
      if (facility.type === "equity") continue;

      balancesByFacility[facility.id] = balance;
      totalOutstanding += balance;
    }

    combinedSeries.push({ period, balancesByFacility, totalOutstanding });
  }

  return { capitalStack, facilities: summaries, combinedSeries };
}
