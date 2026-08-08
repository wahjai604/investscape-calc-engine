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

export type OpExPropertyType =
  | "sfh"
  | "duplex"
  | "triplex"
  | "fourplex"
  | "multifamily_5_20"
  | "multifamily_20plus"
  | "commercial"
  | "mixed_use";

export type LocationTier = "urban" | "suburban" | "rural";

export interface OpExBenchmarkInput {
  propertyType: OpExPropertyType;
  /** For reference/sizing only — not used in the % calculation itself (the E26 spec's rate table doesn't vary by country either; see calculateOpExBenchmark's JSDoc). */
  grossAnnualRent: number;
  country: "Canada" | "US";
  locationTier: LocationTier;
  includePropertyManagement: boolean;
  /** e.g. 0.08 for 8%. Only applied when includePropertyManagement is true; if that flag is true but this is omitted, 0 is added — no default management rate is assumed. */
  propertyManagementPercent?: number;
}

export interface OpExBreakdown {
  propertyTax_percent: number;
  insurance_percent: number;
  maintenance_repair_percent: number;
  utilities_percent: number;
  /** Always 0 — there's no vacancy-inclusion input anywhere in this module, and the E26 spec explicitly excludes vacancy from the residential benchmark rates (no contrary rule exists for commercial either). */
  vacancy_percent: number;
  propertyManagement_percent: number;
}

export interface OpExBenchmarkResult {
  propertyType: string;
  /** e.g. 0.25 for 25%. */
  opexPercentOfGrossRent: number;
  /** grossAnnualRent × opexPercentOfGrossRent. */
  estimatedAnnualOpEx: number;
  opexBreakdown: OpExBreakdown;
  summary: string;
  disclaimer: string;
}
