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

/**
 * One IRR-hurdle tier. `irrHurdle` is the tier's upper bound (exclusive) —
 * use `Infinity` for the open-ended top tier. Tiers must be supplied in
 * ascending `irrHurdle` order. `lpSplit` + `gpSplit` should sum to 1.0; if
 * they don't, calculateSyndicationWaterfall normalizes them and reports it
 * in `issues[]` rather than silently under- or over-allocating cash.
 */
export interface WaterfallTier {
  irrHurdle: number;
  lpSplit: number;
  gpSplit: number;
}

export interface LPContribution {
  investorId: string;
  amount: number;
}

export interface WaterfallCashFlowPeriod {
  period: number;
  distributableCash: number;
}

export interface SyndicationWaterfallInput {
  totalEquityRaised: number;
  lpContributions: LPContribution[];
  /** Annual, cumulative, COMPOUNDING preferred return rate. Defaults to DEFAULT_PREFERRED_RETURN_RATE (8%) when omitted. */
  preferredReturnRate?: number;
  /** GP's target share of the (preferred + catch-up) pool — see E72's grossed-up formula. Defaults to DEFAULT_GP_CATCHUP_PERCENT (20%) when omitted. */
  gpCatchUpPercent?: number;
  /** IRR-hurdle tier table for the final profit split (tier 4). Defaults to DEFAULT_WATERFALL_TIERS when omitted — a common real-world v1 default, not a universal rule; every deal negotiates its own. */
  tiers?: WaterfallTier[];
  cashFlows: WaterfallCashFlowPeriod[];
}

/** One LP investor's pro-rata slice of a period's distribution, by their share of total LP contributions. */
export interface LPInvestorDistribution {
  investorId: string;
  returnOfCapital: number;
  preferredReturnPaid: number;
  /** This investor's pro-rata share of the tier-4 LP-side split this period. 0 in periods where tier 4 isn't reached. */
  profitShare: number;
  total: number;
}

export interface WaterfallTierSplitAmount {
  tierIndex: number;
  lpAmount: number;
  gpAmount: number;
}

export interface WaterfallDistribution {
  period: number;
  /** Aggregate across all LPs — see lpBreakdown for the pro-rata per-investor split. */
  returnOfCapital: number;
  preferredReturnPaid: number;
  gpCatchUpPaid: number;
  /** Empty when tier 4 isn't reached this period (all cash absorbed by capital/preferred/catch-up). Currently always at most one entry — see docs/SYNDICATION-WATERFALL-SOURCES.md for why tier selection is resolved once per period rather than sub-split within a period. */
  tierSplitAmounts: WaterfallTierSplitAmount[];
  lpTotal: number;
  gpTotal: number;
  lpBreakdown: LPInvestorDistribution[];
}

export interface SyndicationWaterfallResult {
  distributions: WaterfallDistribution[];
  lpTotalReturn: number;
  gpTotalReturn: number;
  /** IRR on the pooled LP cash flow series ([-totalLPContributions, ...lpTotal per period]). NaN if it can't be computed (e.g. no distributions yet). */
  lpEffectiveIRR: number;
  /** gpTotalReturn / totalProfitDistributed (profit = all distributions minus return of capital). 0 when no profit has been distributed yet. */
  gpEffectivePromotePercent: number;
  issues: string[];
}
