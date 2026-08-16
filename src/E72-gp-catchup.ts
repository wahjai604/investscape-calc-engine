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

import { GPCatchUpPeriodInput, GPCatchUpPeriodResult } from "./types";

/**
 * Grossed-up GP catch-up target — THE single most commonly miscalculated
 * provision in LP/GP syndication waterfalls (per the sourced 2026 research;
 * see docs/SYNDICATION-WATERFALL-SOURCES.md). Kept in its own file,
 * separate from E71's multi-period state machine, specifically so this
 * formula has an unambiguous, isolated golden test.
 *
 * The common WRONG shortcut is `preferredDistribution * gpCatchUpPercent` —
 * a flat percentage of what LPs already received. That undercounts the
 * catch-up, because `gpCatchUpPercent` is GP's target share of the
 * COMBINED (preferred + catch-up) pool, not of the preferred distribution
 * alone:
 *
 *   catchUpAmount / (preferredDistribution + catchUpAmount) = gpCatchUpPercent
 *   => catchUpAmount = (preferredDistribution / (1 - gpCatchUpPercent)) * gpCatchUpPercent
 *
 * Worked example (the golden test): $80 preferred distributed, 20%
 * catch-up target.
 *   Correct (grossed-up): (80 / (1 - 0.20)) * 0.20 = (80 / 0.80) * 0.20 = $20
 *   WRONG (flat %):        80 * 0.20 = $16 — must never ship this.
 */
export function calculateGrossedUpCatchUpTarget(
  cumulativePreferredPaidToDate: number,
  gpCatchUpPercent: number
): number {
  if (gpCatchUpPercent <= 0) return 0;
  if (gpCatchUpPercent >= 1) {
    throw new Error(
      "gpCatchUpPercent must be less than 1 (100%) — the grossed-up formula divides by (1 - gpCatchUpPercent)"
    );
  }
  return (cumulativePreferredPaidToDate / (1 - gpCatchUpPercent)) * gpCatchUpPercent;
}

/**
 * Per-period wrapper around the grossed-up formula: subtracts what GP has
 * already caught up on in prior periods, then caps the result by the cash
 * actually available this period. An unpaid catch-up shortfall is NOT
 * dropped — it stays inside catchUpTargetCumulative and is picked up again
 * (still grossed up against the latest cumulative preferred figure) the
 * next time this is called with a higher cumulativePreferredPaidToDate.
 */
export function calculateGPCatchUpForPeriod(
  input: GPCatchUpPeriodInput
): GPCatchUpPeriodResult {
  const {
    cumulativePreferredPaidToDate,
    gpCatchUpPercent,
    cumulativeCatchUpAlreadyPaid,
    availableCash,
  } = input;

  const catchUpTargetCumulative = calculateGrossedUpCatchUpTarget(
    cumulativePreferredPaidToDate,
    gpCatchUpPercent
  );
  const catchUpOwedThisPeriod = Math.max(
    0,
    catchUpTargetCumulative - cumulativeCatchUpAlreadyPaid
  );
  const catchUpPaidThisPeriod = Math.max(0, Math.min(availableCash, catchUpOwedThisPeriod));

  return { catchUpTargetCumulative, catchUpOwedThisPeriod, catchUpPaidThisPeriod };
}
