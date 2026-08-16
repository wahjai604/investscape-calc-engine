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
 * PHASE 2 — INTERFACES ONLY. Nothing in this file is implemented.
 *
 * Short-term rental (STR) revenue projection is explicitly deferred — it
 * requires a real market-data source decision (AirDNA, Rabbu, or an
 * equivalent third-party STR comp provider) before any real math can be
 * written, and no such data source is wired into this codebase today.
 * Not E-numbered, matching this engine family's convention (see
 * investscape-docs Doc 63 §1 and Doc 64 §1): unimplemented Phase 2
 * contracts don't get an E-number until they're actually implemented.
 *
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below.
 */

export interface STRRevenueProjectionRequest {
  address: string;
  bedrooms: number;
  propertyType: string;
  amenityTier?: string;
  dataSource: "third_party_projection" | "actual_platform_history";
  trailingMonthsOfHistory?: number;
}

export interface STRRevenueProjectionResult {
  projectedGrossAnnualRevenue: number | null;
  qualifyingIncomeAfterHaircut: number | null;
  dataSourceUsed: string;
  methodology: string;
  issues: string[];
}

/**
 * Not implemented. Throws immediately so an accidental call surfaces
 * loudly rather than silently returning a fabricated revenue projection —
 * there is no "close enough" placeholder for STR income without a real
 * comp data source behind it.
 */
export function projectSTRRevenue(
  _r: STRRevenueProjectionRequest
): STRRevenueProjectionResult {
  throw new Error(
    "Phase 2 not implemented: requires a real market-data source decision (AirDNA/Rabbu/equivalent) first. See STR Engine Master Spec in the project vault."
  );
}
