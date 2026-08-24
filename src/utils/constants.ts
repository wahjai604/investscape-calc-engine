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

import type { WaterfallTier } from "../types";

// Shared numeric thresholds, defaults, and rates used by the calculation
// engines. Values are unchanged from where they previously lived inline in
// each engine file — this only centralizes them.

// E6: qualifying (GDS/TDS stress test)
export const MINIMUM_QUALIFYING_RATE = 0.0525;
export const STRESS_TEST_BUFFER = 0.02;
export const GDS_MAX_RATIO = 0.39;
export const TDS_MAX_RATIO = 0.44;

// E7: cmhc
export const EXTENDED_AMORTIZATION_SURCHARGE = 0.002;

// E9: dscr
export const MINIMUM_DSCR = 1.2;

// E11: ptt (BC PTT brackets + FTHB exemption)
export const BRACKET_1_LIMIT = 200_000;
export const BRACKET_2_LIMIT = 2_000_000;
export const RESIDENTIAL_SURCHARGE_THRESHOLD = 3_000_000;
export const BRACKET_1_RATE = 0.01;
export const BRACKET_2_RATE = 0.02;
export const BRACKET_3_RATE = 0.03;
export const RESIDENTIAL_SURCHARGE_RATE = 0.02;
/** FMV at or below this qualifies for a full FTHB exemption, all other criteria being met. */
export const FTHB_FMV_FULL_EXEMPTION_MAX = 835_000;
/** FMV at or above this gets no FTHB exemption at all; between the two thresholds, the exemption phases out linearly. */
export const FTHB_FMV_PHASEOUT_MAX = 860_000;
/** A full exemption covers tax on this much of the purchase price (BC FTHB Program). */
export const FTHB_EXEMPTION_PRICE_THRESHOLD = 500_000;
export const FTHB_MAX_PROPERTY_SIZE_HECTARES = 0.5;

// E12: break-even
export const MIN_DOWN_PAYMENT_PERCENT = 0.05;
export const MAX_DOWN_PAYMENT_PERCENT = 0.95;
/** Bisection stops once the candidate annual cash flow is within $1 of zero. */
export const CASH_FLOW_TOLERANCE = 1;
export const BREAK_EVEN_MAX_BISECTION_ITERATIONS = 100;

// E14: refinance
export const DEFAULT_REFINANCING_COSTS_PERCENT = 0.015;

// E16: brrrr
export const PURCHASE_CLOSING_COSTS_PERCENT = 0.02;
export const REFINANCE_CLOSING_COSTS_PERCENT = 0.015;
export const DEFAULT_REFINANCE_LTV_PERCENT = 0.75;
/** Applied to gross rent as a simple opex proxy for both capRate and monthlyPositiveCashFlow — no per-line-item expense breakdown exists at this stage of a BRRRR deal (rehab isn't even finished/leased yet). */
export const OPEX_PERCENT_OF_RENT = 0.3;

// E17: holding-period-sensitivity
export const MIN_HOLD_YEARS = 1;
export const MAX_HOLD_YEARS = 30;

// E18: tax-optimization
export const US_RESIDENTIAL_USEFUL_LIFE_YEARS = 27.5;
export const US_COMMERCIAL_USEFUL_LIFE_YEARS = 39;
/** CCA Class 1 (most residential and commercial rental buildings) — the spec only gives a residential rate, so this is applied to commercial too in the absence of a distinct rate; still $0 for land. */
export const CANADA_CCA_RATE = 0.04;

// E19: data-provenance
export const RECENCY_FRESH_DAYS = 30;
export const RECENCY_STALE_DAYS = 365;

// E20: fx-conversion
export const BISECTION_IRR_TOLERANCE = 0.0001;
export const FX_MAX_BISECTION_ITERATIONS = 100;
export const RATE_SEARCH_MIN_MULTIPLE = 0.1;
export const RATE_SEARCH_MAX_MULTIPLE = 10;

// E24: insurance-estimation
export const DWELLING_SHARE_OF_COMBINED_RATE = 0.85;
export const LIABILITY_SHARE_OF_COMBINED_RATE = 0.15;

// E71-E72: syndication waterfall (LP/GP capital structure)
// See docs/SYNDICATION-WATERFALL-SOURCES.md for the full citations behind
// every value below.

/** Cumulative, COMPOUNDING annual preferred return to LPs before any GP promote. Real 2026 range is 6-9%; 8% is the single most common default. Always overridable per deal — no formula here is universal. */
export const DEFAULT_PREFERRED_RETURN_RATE = 0.08;
/** GP's target share of the (preferred + catch-up) pool, applied via E72's grossed-up formula — NOT a flat percentage of the preferred distribution. Falls inside DEFAULT_GP_PROMOTE_RANGE_MIN/MAX. */
export const DEFAULT_GP_CATCHUP_PERCENT = 0.2;
/** Typical real-world GP promote range above the first hurdle. Documentation/rationale only — DEFAULT_GP_CATCHUP_PERCENT and DEFAULT_WATERFALL_TIERS' first promote-bearing tier both fall inside this range; it isn't wired into a formula on its own. */
export const DEFAULT_GP_PROMOTE_RANGE_MIN = 0.15;
export const DEFAULT_GP_PROMOTE_RANGE_MAX = 0.25;
/**
 * v1 default IRR-hurdle tier table for the final profit split. Documented
 * as a common real-world default — ~85% of real waterfalls use IRR (not
 * equity multiple) as the hurdle metric — NOT a universal rule; real deals
 * are individually negotiated. `irrHurdle` is each tier's upper bound
 * (exclusive); `Infinity` marks the open-ended top tier. Must stay in
 * ascending `irrHurdle` order.
 */
export const DEFAULT_WATERFALL_TIERS: WaterfallTier[] = [
  { irrHurdle: 0.08, lpSplit: 1.0, gpSplit: 0.0 },
  { irrHurdle: 0.12, lpSplit: 0.8, gpSplit: 0.2 },
  { irrHurdle: 0.15, lpSplit: 0.7, gpSplit: 0.3 },
  { irrHurdle: Infinity, lpSplit: 0.5, gpSplit: 0.5 },
];

// E73-E77: US mortgage qualifying (DTI stress tiers, conforming loan limit,
// FHA MIP, conventional PMI, loan-convention DSCR, 75% qualifying-rental-
// income rule). See docs/US-QUALIFIER-SOURCES.md for the full citations
// behind every value below.

// --- E73: DTI stress tiers + conforming loan limit ---

/** Manual-underwriting baseline max back-end DTI (Fannie Mae Selling Guide B3-6-02). */
export const US_DTI_MANUAL_MAX = 0.36;
/** Manual-underwriting max back-end DTI when a real compensating factor is met (credit score, reserves, or LTV — see US_DTI_COMPENSATING_* below). */
export const US_DTI_COMPENSATING_MAX = 0.45;
/** Automated-underwriting (DU/LPA-equivalent "Approve/Eligible") max back-end DTI. */
export const US_DTI_AUTOMATED_MAX = 0.5;

export const US_DTI_COMPENSATING_MIN_CREDIT_SCORE = 680;
export const US_DTI_COMPENSATING_MIN_RESERVE_MONTHS = 6;
export const US_DTI_COMPENSATING_MAX_LTV = 0.75;

/** 2026 FHFA conforming loan limit, standard 1-unit property, most of the country. */
export const US_CONFORMING_LOAN_LIMIT_STANDARD = 832_750;
/** 2026 FHFA conforming loan limit, high-cost areas (AK/HI/Guam/USVI and FHFA-designated high-cost counties, capped at 150% of the standard limit). */
export const US_CONFORMING_LOAN_LIMIT_HIGH_COST = 1_249_125;

// --- E74: FHA MIP ---

export const FHA_UFMIP_RATE = 0.0175;
/**
 * Composed directly from the sourced range endpoints (0.55% typical /
 * 0.50% with >=5% down / up to 0.75% for higher-LTV+larger-loan / as low
 * as 0.15% for 15yr+substantial down): base annual rate by term and LTV
 * tier, plus a surcharge added when the loan exceeds the applicable
 * conforming limit. 0.55% + 0.20% surcharge = 0.75%, the documented
 * ceiling. See docs/US-QUALIFIER-SOURCES.md for how these compose.
 */
export const FHA_ANNUAL_MIP_TIERS = {
  thirtyYear: {
    /** Down payment < 5% (LTV > 95%). */
    highLTVRate: 0.0055,
    /** Down payment >= 5%. */
    lowLTVRate: 0.005,
  },
  fifteenYear: {
    /** Down payment < 10% (LTV > 90%). */
    highLTVRate: 0.004,
    /** Down payment >= 10% (substantial down payment). */
    lowLTVRate: 0.0015,
  },
  /** Added to the base rate above when loanAmount exceeds the applicable conforming limit. */
  aboveConformingLimitSurcharge: 0.002,
} as const;

/** Down-payment threshold (post-2013 FHA rule) below which annual MIP never removes automatically and runs for the life of the loan. */
export const FHA_MIP_ELEVEN_YEAR_REMOVAL_MIN_DOWN_PAYMENT = 0.1;
export const FHA_MIP_AUTOMATIC_REMOVAL_YEARS = 11;

// --- E75: Conventional PMI ---

export const PMI_REQUIRED_LTV_THRESHOLD = 0.8;
export const PMI_RATE_FLOOR = 0.003;
export const PMI_RATE_CEILING = 0.015;

/** Base annual PMI rate by LTV band, before the credit-score multiplier. maxLTV is inclusive-upper-bound; evaluated in ascending order. */
export const PMI_LTV_TIERS = [
  { maxLTV: 0.85, baseRate: 0.005 },
  { maxLTV: 0.9, baseRate: 0.007 },
  { maxLTV: 0.95, baseRate: 0.009 },
  { maxLTV: 0.97, baseRate: 0.012 },
] as const;

/** Multiplier applied to the LTV-tier base rate. minScore is inclusive; evaluated highest-first (first match wins). */
export const PMI_CREDIT_SCORE_MULTIPLIERS = [
  { minScore: 760, multiplier: 0.6 },
  { minScore: 700, multiplier: 1.0 },
  { minScore: 680, multiplier: 1.3 },
  { minScore: 0, multiplier: 1.5 },
] as const;

// --- E76: Loan-convention DSCR (gross rent / PITIA) ---
// NOT the same metric as E9's calculateDSCR/evaluateDSCR (NOI / annual
// debt service, the commercial convention) — see E76's own file header.

/** Admin-overridable default minimum ratio to qualify at all. */
export const DSCR_LOAN_MIN_RATIO_DEFAULT = 1.0;
/** Ratio at/above which a loan-convention DSCR loan typically unlocks the lender's best pricing tier — informational, not a qualify/no-qualify gate. */
export const DSCR_LOAN_STRONG_RATIO_THRESHOLD = 1.25;
export const DSCR_LOAN_MIN_FICO_DEFAULT = 620;
export const DSCR_LOAN_MIN_DOWN_PAYMENT_DEFAULT = 0.2;

// --- E77: US qualifying rental income (75% rule) ---

/** Fannie Mae Selling Guide B3-3.8-01: 75% of gross monthly rent counts toward qualifying income when a signed lease exists (lease-based path only — v1 scope). */
export const RENTAL_INCOME_HAIRCUT = 0.75;

// --- E79: Deal Grade (Property Detail / Deal Analyzer A/B+/B/B-/C badge) ---
// Per-metric brackets follow E25-lender-scorecard.ts's stepped 25/15/5/0
// pattern (full / solid / weak / issue tier) so admin-editing one scoring
// scheme generalizes to the other. Every threshold below is a documented
// product decision, not an authoritative industry standard — there is no
// single agreed-upon cutoff table for combining cap rate / cash-on-cash /
// DSCR / IRR into one grade, so these were chosen for internal consistency
// with values this codebase already treats as meaningful (e.g. DSCR's
// MINIMUM_DSCR = 1.2 above) and common real-estate-investing rules of
// thumb, then named here so they're admin-editable without touching
// E79-deal-grade.ts itself.

/** Unlevered yield (NOI / purchasePrice). 8%+ is a strong buy in most markets; 4-6% is roughly average; below 4% trails a risk-free-adjusted bar. */
export const CAP_RATE_STRONG_THRESHOLD = 0.08;
export const CAP_RATE_SOLID_THRESHOLD = 0.06;
export const CAP_RATE_WEAK_THRESHOLD = 0.04;

/** Levered first-year cash yield. 10%+ is the commonly-cited strong-deal target; below 2% (including negative — a cash-flow-negative deal) is a real red flag, not just a weak number. */
export const CASH_ON_CASH_STRONG_THRESHOLD = 0.1;
export const CASH_ON_CASH_SOLID_THRESHOLD = 0.06;
export const CASH_ON_CASH_WEAK_THRESHOLD = 0.02;

/** DSCR brackets for deal-quality grading. Deliberately reuses MINIMUM_DSCR (1.2, the E9/lender-bankability minimum) as this engine's "solid" tier rather than inventing a second number for the same concept; below 1.0 means NOI doesn't even cover debt service. */
export const DSCR_STRONG_THRESHOLD = 1.5;
export const DSCR_SOLID_THRESHOLD = MINIMUM_DSCR;
export const DSCR_WEAK_THRESHOLD = 1.0;

/** Full-cycle IRR. 18%+ is a typical value-add/opportunistic target; 12-18% a solid core-plus target; 8-12% modest (near typical cost of capital); below 8% weak or negative. */
export const IRR_STRONG_THRESHOLD = 0.18;
export const IRR_SOLID_THRESHOLD = 0.12;
export const IRR_WEAK_THRESHOLD = 0.08;

/**
 * Overall-score (0-100) cutoffs for the A/B+/B/B-/C badge. Deliberately
 * chosen from the set of sums actually reachable by four stepped
 * {0,5,15,25} metric scores (85 and 95, for example, are NOT reachable by
 * any combination of four such scores, so cutoffs land on values that are)
 * — see E79-deal-grade.test.ts's boundary-case tests for the exact
 * combinations that hit each cutoff. Reasoning: 80+ needs most metrics in
 * their top-or-high-mid tier (e.g. two 25s + two 15s); 65+ is solid
 * overall; 50+ is a coin-flip/average deal; 35+ still has some redeeming
 * metrics but real weakness; below that, at least two metrics are sitting
 * in the "issue" tier (5 or 0) — often including a real deal-killer like
 * negative cash flow or DSCR < 1.0.
 */
export const DEAL_GRADE_A_MIN = 80;
export const DEAL_GRADE_B_PLUS_MIN = 65;
export const DEAL_GRADE_B_MIN = 50;
export const DEAL_GRADE_B_MINUS_MIN = 35;

// --- E80: Budget vs. Actuals (Development Studio) ---

/**
 * A line item's variance (budgetedAmount - actualAmount) counts as
 * "on_track" when it's within this percentage of the budgeted amount —
 * draw-timing noise (an invoice landing a few days either side of a
 * reporting cutoff) shouldn't read as a real over/under signal. 2% is a
 * common materiality threshold for construction cost-tracking variance
 * reporting; anything wider is a real deviation worth flagging.
 */
export const BUDGET_VARIANCE_ON_TRACK_PERCENT = 0.02;
/**
 * Used instead of BUDGET_VARIANCE_ON_TRACK_PERCENT only when
 * budgetedAmount is 0 (a percentage-of-zero threshold would be 0, meaning
 * ANY actual spend at all — even $1 — would silently register as "over";
 * this dollar floor avoids that false-positive on genuinely zero-budgeted
 * lines).
 */
export const BUDGET_VARIANCE_ON_TRACK_ABSOLUTE_FLOOR = 500;

// --- E81: Sources ≡ Uses reconciliation (Development Studio) ---

/**
 * Sources and uses are computed from independent inputs (facility amounts,
 * sponsor equity, and four separate uses categories) that can each carry
 * their own floating-point rounding; exact `===` equality would flag a
 * deal as "unbalanced" over a fraction-of-a-cent rounding artifact that
 * isn't a real reconciliation problem. This tolerance is deliberately tiny
 * (one cent) — it exists only to absorb float noise, not to paper over a
 * genuine mismatch, which is exactly what `balanced`/`delta`/`issues` on
 * the result exist to surface instead of silently rounding or forcing the
 * two sides to match.
 */
export const SOURCES_USES_BALANCE_TOLERANCE = 0.01;

// --- E83: Three-test commercial loan sizing (LTV / DSCR / debt yield) ---
// These are suggested starting points for a UI/caller to pre-fill, not
// fallback defaults applied inside calculateCommercialLoanSizing() itself
// — every field on CommercialLoanSizingInput is required. Debt yield in
// particular varies a lot by lender type: CMBS lenders commonly require
// 10% rather than the more common bank/life-co 8% used here, which is
// exactly why minDebtYieldPercent has to stay a caller-supplied input
// rather than a hardcoded constant baked into the engine.

/** Common conventional/life-co commercial max LTV. */
export const COMMERCIAL_LOAN_SIZING_MAX_LTV_PERCENT_DEFAULT = 70;
/** Common commercial minimum DSCR (matches E9's MINIMUM_DSCR-adjacent lender-bankability range, but kept as its own named constant since this is a different test in a different engine). */
export const COMMERCIAL_LOAN_SIZING_MIN_DSCR_DEFAULT = 1.25;
/** Common bank/life-co minimum debt yield; CMBS lenders often require 10% instead — see the section note above. */
export const COMMERCIAL_LOAN_SIZING_MIN_DEBT_YIELD_PERCENT_DEFAULT = 8;

// --- E84: commercial rent roll analytics ---

/**
 * Above this share of total annualized base rent expiring in a single
 * calendar year, a rent roll is considered dangerously concentrated —
 * refinancing or selling in (or just before) that year runs into a lender
 * or buyer discounting the asset for rollover risk. 30% is a common
 * underwriting rule of thumb (no single year should hold more than
 * roughly a third of the building's income at risk at once); kept as a
 * named constant rather than inline so calculateExpiryConcentration's
 * threshold is visible and tunable in one place.
 */
export const COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT = 30;
