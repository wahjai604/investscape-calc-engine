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

export type PropertyTaxCountry = "Canada" | "US";
export type PropertyType = "residential" | "commercial" | "industrial" | "land";
export type TaxRateSource = "provincial_average" | "county_average" | "estimated";

export interface PropertyTaxInput {
  /** Assessed value or fair market value. */
  propertyValue: number;
  country: PropertyTaxCountry;
  /** Used when country is "Canada", e.g. "BC", "ON", "AB". */
  province: string;
  /** Used when country is "US", e.g. "CA", "TX", "AZ", "NY", "FL". */
  state: string;
  propertyType: PropertyType;
  /** Some jurisdictions offer new-construction exemptions; not modeled numerically here (no rates were given for it) — only surfaced as a note in the disclaimer. */
  isNewConstruction: boolean;
}

export interface PropertyTaxResult {
  propertyValue: number;
  /** e.g. 0.008 for 0.8%. */
  effectiveTaxRate: number;
  /** propertyValue × effectiveTaxRate. */
  estimatedAnnualTax: number;
  /** estimatedAnnualTax / 12. */
  taxPerMonth: number;
  /** e.g. "BC", "Texas" — Canadian provinces show their code as given; recognized US states show a full display name. */
  jurisdiction: string;
  taxRateSource: TaxRateSource;
  disclaimer: string;
  summary: string;
}
