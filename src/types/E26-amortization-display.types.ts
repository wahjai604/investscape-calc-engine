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

import { MortgageCountry } from "./common.types";

export type DisplayTrancheType = "senior" | "mezzanine" | "equity";

export interface DisplayTranche {
  id: string;
  type: DisplayTrancheType;
  loanAmount: number;
  annualInterestRate: number;
  amortizationYears: number;
  /** 0 = draws at purchase (month 0 of the combined timeline); 12 = draws one year in, etc. */
  drawDate_month: number;
  country: MortgageCountry;
}

export interface AmortizationDisplayInput {
  tranches: DisplayTranche[];
}

export interface DisplayMonthlyRow {
  /** Global month on the combined timeline (0 = purchase date) — this tranche's drawDate_month plus its own payment month. */
  month: number;
  beginning_balance: number;
  payment: number;
  principal: number;
  interest: number;
  ending_balance: number;
}

/**
 * Tranche-local year (1 = the tranche's own first 12 payments after its
 * draw date), not a calendar year. Staggered draw dates mean tranches don't
 * share a common year boundary, so rolling up by each tranche's own payment
 * history — same approach as trancheAmortizationSchedule() in
 * amortization.ts — avoids misaligned partial-year buckets.
 */
export interface DisplayAnnualRow {
  year: number;
  beginning_balance: number;
  annual_payment: number;
  annual_principal: number;
  annual_interest: number;
  ending_balance: number;
}

export interface TrancheSchedule {
  tranche_id: string;
  type: DisplayTrancheType;
  /** Chart line color for this tranche's type, per the fixed legend mapping (senior=blue, mezzanine=orange, equity=gold). */
  color: string;
  monthly_rows: DisplayMonthlyRow[];
  annual_summary: DisplayAnnualRow[];
  /** Global month at which this tranche's balance reaches $0. */
  payoff_month: number;
  total_interest_paid: number;
}

export interface CombinedView {
  /** Duration in months of the combined timeline, from month 0 through the last tranche's payoff. */
  month_count: number;
  /** Global month at which every tranche has reached a $0 balance — the same instant as month_count, framed as an absolute month rather than a duration. */
  all_tranches_zero_month: number;
}

export interface AmortizationDisplayResult {
  tranche_schedules: TrancheSchedule[];
  combined_view: CombinedView;
}
