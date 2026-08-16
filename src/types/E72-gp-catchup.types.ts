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

export interface GPCatchUpPeriodInput {
  /** Cumulative preferred return paid to LPs to date, INCLUDING this period's preferred payment. */
  cumulativePreferredPaidToDate: number;
  /** GP's target share of the combined (preferred + catch-up) pool, e.g. 0.20 for 20%. */
  gpCatchUpPercent: number;
  /** Cumulative GP catch-up already paid in prior periods. */
  cumulativeCatchUpAlreadyPaid: number;
  /** Cash remaining this period after return of capital and preferred return have been paid. */
  availableCash: number;
}

export interface GPCatchUpPeriodResult {
  /** Grossed-up cumulative catch-up target: what GP should have received by now to reach gpCatchUpPercent of (preferred + catch-up) — see calculateGrossedUpCatchUpTarget. */
  catchUpTargetCumulative: number;
  /** catchUpTargetCumulative minus what's already been paid — the full amount still owed, before the cash-availability cap. */
  catchUpOwedThisPeriod: number;
  /** min(catchUpOwedThisPeriod, availableCash) — what actually gets paid this period. Any shortfall stays in catchUpTargetCumulative and carries forward to the next period. */
  catchUpPaidThisPeriod: number;
}
