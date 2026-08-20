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

import { Tranche, TrancheType, CapitalStackResult } from "./E8-capitalstack.types";

/** One facility in the financing table — a Tranche plus the id used to key it across facilities/interestReserveSchedules/combinedSeries. */
export interface FinancingFacility extends Tranche {
  id: string;
}

export interface FinancingTableInput {
  facilities: FinancingFacility[];
  taxRate?: number;
  /**
   * Number of months the combined timeline covers. Amortizing facilities
   * (senior_debt/mezzanine) run their own amortizationYears*12 schedule and
   * are padded with a $0 balance beyond payoff if that's shorter than
   * months; presale_deposit facilities use this as their bullet
   * repaymentMonth, since they have no amortizationYears of their own.
   */
  months: number;
}

export interface FacilityInterestReserveRow {
  period: number;
  interestAccrued: number;
  /** interestReserveAmount minus cumulative interestAccrued through this period, floored at 0. */
  reserveBalance: number;
  /** True from the first period the reserve hits $0 onward. */
  reserveDepleted: boolean;
}

export interface FacilitySummary {
  id: string;
  type: TrancheType;
  amount: number;
  commitmentFeeAmount: number;
  netAdvance: number;
  interestReserveAmount: number;
  /** Empty when interestReserveAmount is 0/omitted — nothing to draw down. */
  interestReserveSchedule: FacilityInterestReserveRow[];
}

export interface CombinedPeriodRow {
  period: number;
  /** This period's outstanding balance per facility id — the series a stacked area/line chart plots directly. Equity facilities are omitted (they carry no balance/schedule). */
  balancesByFacility: Record<string, number>;
  totalOutstanding: number;
}

export interface FinancingTableResult {
  capitalStack: CapitalStackResult;
  facilities: FacilitySummary[];
  /** Period-by-period ($ y-axis, period x-axis) combined series across every non-equity facility. */
  combinedSeries: CombinedPeriodRow[];
}
