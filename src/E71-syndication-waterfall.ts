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

import { calculateGPCatchUpForPeriod } from "./E72-gp-catchup";
import { calculateIRR } from "./E5-returns";
import {
  DEFAULT_GP_CATCHUP_PERCENT,
  DEFAULT_PREFERRED_RETURN_RATE,
  DEFAULT_WATERFALL_TIERS,
} from "./utils/constants";
import {
  LPContribution,
  LPInvestorDistribution,
  SyndicationWaterfallInput,
  SyndicationWaterfallResult,
  WaterfallDistribution,
  WaterfallTier,
  WaterfallTierSplitAmount,
} from "./types";

const EQUITY_RAISED_TOLERANCE = 0.01;
const SPLIT_SUM_TOLERANCE = 1e-9;

/**
 * American (deal-by-deal) LP/GP distribution waterfall — v1 scope
 * deliberately excludes European/whole-fund waterfalls, which need a "fund"
 * entity spanning multiple deals that doesn't exist in this data model yet.
 *
 * Strict tier order per period, no partial-tier bleed-through:
 *   1. Return of capital (pro-rata by LP contribution)
 *   2. Preferred return — cumulative, COMPOUNDING (unpaid preferred itself
 *      accrues the preferred rate, not just the outstanding capital)
 *   3. GP catch-up (grossed-up formula — see E72; the highest-bug-risk step)
 *   4. Final profit split per the IRR-hurdle tier table
 *
 * Any shortfall in a tier during a given period carries forward (both
 * unreturned capital and unpaid preferred keep compounding) rather than
 * being silently dropped — see docs/SYNDICATION-WATERFALL-SOURCES.md for
 * the sourced conventions and every simplification made here.
 */
export function calculateSyndicationWaterfall(
  input: SyndicationWaterfallInput
): SyndicationWaterfallResult {
  const issues: string[] = [];

  const preferredReturnRate = input.preferredReturnRate ?? DEFAULT_PREFERRED_RETURN_RATE;
  const gpCatchUpPercent = input.gpCatchUpPercent ?? DEFAULT_GP_CATCHUP_PERCENT;
  const tiers = normalizeTiers(input.tiers ?? DEFAULT_WATERFALL_TIERS, issues);

  const totalLPContributions = input.lpContributions.reduce((sum, lp) => sum + lp.amount, 0);
  if (Math.abs(totalLPContributions - input.totalEquityRaised) > EQUITY_RAISED_TOLERANCE) {
    issues.push(
      `totalEquityRaised ($${input.totalEquityRaised.toFixed(2)}) does not match the sum of lpContributions ($${totalLPContributions.toFixed(2)}); the sum of lpContributions was used for all capital/preferred math.`
    );
  }

  const sortedCashFlows = [...input.cashFlows].sort((a, b) => a.period - b.period);

  let capitalBalance = totalLPContributions;
  let preferredBalanceOwed = 0;
  let cumulativePreferredPaid = 0;
  let cumulativeCatchUpPaid = 0;

  const distributions: WaterfallDistribution[] = [];
  const priorPeriodLPTotals: number[] = [];

  for (const cashFlowPeriod of sortedCashFlows) {
    // Preferred return accrues on the outstanding capital AND any already-
    // accrued-but-unpaid preferred — that's what makes it compounding
    // rather than simple interest.
    const interestThisPeriod = (capitalBalance + preferredBalanceOwed) * preferredReturnRate;
    preferredBalanceOwed += interestThisPeriod;

    let remainingCash = Math.max(0, cashFlowPeriod.distributableCash);

    const returnOfCapital = Math.min(remainingCash, capitalBalance);
    capitalBalance -= returnOfCapital;
    remainingCash -= returnOfCapital;

    const preferredReturnPaid = Math.min(remainingCash, preferredBalanceOwed);
    preferredBalanceOwed -= preferredReturnPaid;
    remainingCash -= preferredReturnPaid;
    cumulativePreferredPaid += preferredReturnPaid;

    // Catch-up only activates once capital and preferred are FULLY caught
    // up cumulatively — strict tier order, no bleed-through from a
    // partially-satisfied tier 1/2.
    let gpCatchUpPaid = 0;
    if (capitalBalance === 0 && preferredBalanceOwed === 0 && remainingCash > 0) {
      const catchUp = calculateGPCatchUpForPeriod({
        cumulativePreferredPaidToDate: cumulativePreferredPaid,
        gpCatchUpPercent,
        cumulativeCatchUpAlreadyPaid: cumulativeCatchUpPaid,
        availableCash: remainingCash,
      });
      gpCatchUpPaid = catchUp.catchUpPaidThisPeriod;
      cumulativeCatchUpPaid += gpCatchUpPaid;
      remainingCash -= gpCatchUpPaid;
    }

    const tierSplitAmounts: WaterfallTierSplitAmount[] = [];
    let tier4LPAmount = 0;
    let tier4GPAmount = 0;
    if (remainingCash > 0) {
      const partialLPTotalThisPeriod = returnOfCapital + preferredReturnPaid;
      const achievedIRR = calculateIRR([
        -totalLPContributions,
        ...priorPeriodLPTotals,
        partialLPTotalThisPeriod,
      ]);
      const tierIndex = selectTierIndex(tiers, achievedIRR);
      const tier = tiers[tierIndex];

      tier4LPAmount = remainingCash * tier.lpSplit;
      tier4GPAmount = remainingCash * tier.gpSplit;
      tierSplitAmounts.push({ tierIndex, lpAmount: tier4LPAmount, gpAmount: tier4GPAmount });
      remainingCash -= tier4LPAmount + tier4GPAmount;
    }

    const lpTotal = returnOfCapital + preferredReturnPaid + tier4LPAmount;
    const gpTotal = gpCatchUpPaid + tier4GPAmount;

    const lpBreakdown = buildLPBreakdown(
      input.lpContributions,
      totalLPContributions,
      returnOfCapital,
      preferredReturnPaid,
      tier4LPAmount
    );

    distributions.push({
      period: cashFlowPeriod.period,
      returnOfCapital,
      preferredReturnPaid,
      gpCatchUpPaid,
      tierSplitAmounts,
      lpTotal,
      gpTotal,
      lpBreakdown,
    });

    priorPeriodLPTotals.push(lpTotal);
  }

  if (capitalBalance > EQUITY_RAISED_TOLERANCE || preferredBalanceOwed > EQUITY_RAISED_TOLERANCE) {
    issues.push(
      `$${capitalBalance.toFixed(2)} of capital and $${preferredBalanceOwed.toFixed(2)} of accrued preferred return remain unpaid after the last supplied cash flow period.`
    );
  }

  const lpTotalReturn = distributions.reduce((sum, d) => sum + d.lpTotal, 0);
  const gpTotalReturn = distributions.reduce((sum, d) => sum + d.gpTotal, 0);
  const totalCapitalReturned = distributions.reduce((sum, d) => sum + d.returnOfCapital, 0);
  const totalProfitDistributed = lpTotalReturn + gpTotalReturn - totalCapitalReturned;

  const gpEffectivePromotePercent =
    totalProfitDistributed > 0 ? gpTotalReturn / totalProfitDistributed : 0;
  const lpEffectiveIRR = calculateIRR([-totalLPContributions, ...priorPeriodLPTotals]);

  return {
    distributions,
    lpTotalReturn,
    gpTotalReturn,
    lpEffectiveIRR,
    gpEffectivePromotePercent,
    issues,
  };
}

/**
 * Rescales any tier whose lpSplit + gpSplit doesn't sum to 1.0 so the
 * period's remainingCash is still allocated in full — a malformed split
 * table shouldn't silently create or destroy cash — while recording the
 * problem as a typed issue rather than papering over it invisibly.
 */
function normalizeTiers(tiers: WaterfallTier[], issues: string[]): WaterfallTier[] {
  return tiers.map((tier, index) => {
    const sum = tier.lpSplit + tier.gpSplit;
    if (Math.abs(sum - 1) <= SPLIT_SUM_TOLERANCE) return tier;

    issues.push(
      `Tier ${index} (irrHurdle=${tier.irrHurdle}) splits sum to ${sum}, not 1.0; normalized to lpSplit=${(tier.lpSplit / sum).toFixed(4)}, gpSplit=${(tier.gpSplit / sum).toFixed(4)}.`
    );
    return { irrHurdle: tier.irrHurdle, lpSplit: tier.lpSplit / sum, gpSplit: tier.gpSplit / sum };
  });
}

/**
 * Picks the tier whose irrHurdle first exceeds the LP's achieved IRR as of
 * the start of this period's tier-4 distribution (i.e. tier changes take
 * effect at period boundaries, not intra-period). Falls back to the first
 * (most conservative) tier when IRR can't be computed yet — typically an
 * early period with too little cash flow history for Newton-Raphson to
 * converge.
 */
function selectTierIndex(tiers: WaterfallTier[], achievedIRR: number): number {
  if (Number.isNaN(achievedIRR)) return 0;
  const index = tiers.findIndex((tier) => achievedIRR < tier.irrHurdle);
  return index === -1 ? tiers.length - 1 : index;
}

function buildLPBreakdown(
  lpContributions: LPContribution[],
  totalLPContributions: number,
  returnOfCapital: number,
  preferredReturnPaid: number,
  tier4LPAmount: number
): LPInvestorDistribution[] {
  return lpContributions.map((lp) => {
    const share = totalLPContributions > 0 ? lp.amount / totalLPContributions : 0;
    const lpReturnOfCapital = returnOfCapital * share;
    const lpPreferredReturnPaid = preferredReturnPaid * share;
    const lpProfitShare = tier4LPAmount * share;

    return {
      investorId: lp.investorId,
      returnOfCapital: lpReturnOfCapital,
      preferredReturnPaid: lpPreferredReturnPaid,
      profitShare: lpProfitShare,
      total: lpReturnOfCapital + lpPreferredReturnPaid + lpProfitShare,
    };
  });
}
