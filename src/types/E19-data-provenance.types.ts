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

export type ProvenanceSource = "user_input" | "market_data" | "appraised" | "estimated" | "calculated";

export interface ProvenanceEntry {
  value: number;
  source: ProvenanceSource;
  /** 0.0-1.0 (1.0 = certain, 0.5 = moderate, 0.0 = guess). */
  confidence: number;
  /** ISO 8601, e.g. "2026-08-04". */
  lastUpdatedDate: string;
}

/**
 * One entry per numeric field of scenario.ts's DealParameters — the E22
 * spec says to "use existing field definitions from scenario.ts/deal
 * inputs" rather than inventing a new field list. DealParameters.country
 * is excluded: it's a string enum, not a number, so it doesn't fit
 * ProvenanceEntry's value: number shape.
 *
 * Every field is optional — a caller may not have provenance data for
 * every input yet. Missing fields are surfaced via recommendedActions
 * ("X has not yet been provided") rather than appearing in fieldsTracked,
 * since fieldsTracked's value/confidence/etc. fields are all non-nullable
 * and there's no honest number to report for a field that was never
 * supplied.
 */
export interface DataProvenanceInput {
  purchasePrice?: ProvenanceEntry;
  downPaymentPercent?: ProvenanceEntry;
  annualInterestRate?: ProvenanceEntry;
  amortizationYears?: ProvenanceEntry;
  grossAnnualRent?: ProvenanceEntry;
  vacancyRatePercent?: ProvenanceEntry;
  annualOperatingExpenses?: ProvenanceEntry;
  equityInvested?: ProvenanceEntry;
}

export type ConfidenceLabel = "High" | "Moderate" | "Low" | "Uncertain";

export interface TrackedField {
  fieldName: string;
  value: number;
  source: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  qualityScore: number;
  ageInDays: number;
}

export interface DataProvenanceResult {
  fieldsTracked: TrackedField[];
  overallDataQualityScore: number;
  /** Average confidence per source actually present among fieldsTracked — sources with no fields simply don't appear here. */
  confidenceBySource: Partial<Record<ProvenanceSource, number>>;
  recommendedActions: string[];
  summary: string;
}
