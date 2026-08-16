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
