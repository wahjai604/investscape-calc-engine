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
 * Climate/catastrophe risk assessment (flood tier, wildfire tier,
 * insurance availability) is explicitly deferred — it requires a real
 * catastrophe-risk data source decision (e.g. First Street, CoreLogic, or
 * an equivalent flood/wildfire model provider) before any real math can
 * be written. Not E-numbered, matching this engine family's convention
 * (see investscape-docs Doc 63 §1 and Doc 64 §1).
 *
 * Checked against E24 (Insurance Estimation, src/E24-insurance-estimation.ts)
 * before writing this file, per the request that raised this question —
 * there is no overlap. E24 is a flat industry-benchmark rate-table
 * estimator: it computes an insurance *cost* percentage from
 * (country, propertyType, buildingAgeYears, loanToValuePercent) plus a US
 * PMI add-on, with no address input and no geographic/catastrophe data of
 * any kind. It has no flood zone, no wildfire exposure, and no concept of
 * coverage *availability* (as opposed to price) — the three things this
 * file's contract asks for. E24 stays untouched; nothing here reuses or
 * extends it.
 *
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below.
 */

export interface ClimateRiskAssessmentRequest {
  address: string;
  propertyType: string;
  dataSource: "third_party_catastrophe_model" | "flood_zone_designation_only";
}

export interface ClimateRiskAssessmentResult {
  floodRiskTier: "low" | "moderate" | "high" | "unknown";
  wildfireRiskTier: "low" | "moderate" | "high" | "unknown";
  insuranceAvailabilityFlag: "standard_market" | "surplus_lines_likely" | "coverage_at_risk" | "unknown";
  estimatedInsuranceCostPressure: number | null;
  issues: string[];
}

/**
 * Not implemented. Throws immediately so an accidental call surfaces
 * loudly rather than silently returning a fabricated risk tier — there is
 * no "close enough" placeholder for flood/wildfire risk without a real
 * catastrophe-model data source behind it.
 */
export function assessClimateRisk(
  _r: ClimateRiskAssessmentRequest
): ClimateRiskAssessmentResult {
  throw new Error(
    "Phase 2 not implemented: requires a real catastrophe-risk data source decision first. See Risk/Insurance Engine Master Spec."
  );
}
