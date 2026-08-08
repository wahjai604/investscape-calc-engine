export type InsurancePropertyType = "sfh" | "duplex" | "multifamily" | "commercial";
export type InsuranceCountry = "Canada" | "US";

export interface InsuranceEstimationInput {
  /** Or replacementValue, for insurance purposes. */
  propertyValue: number;
  propertyType: InsurancePropertyType;
  country: InsuranceCountry;
  /** Not used in any calculation — the E27 spec's PMI table varies only by LTV, not by state. */
  state?: string;
  /** 0.80 for 80% LTV. Used for PMI eligibility/rate (US only). */
  loanToValuePercent: number;
  /** Not used in any calculation — no rate adjustment tied to prior insurance history is given anywhere in the E27 spec's benchmark tables, despite the field's own description implying one. */
  hasBeenInsured: boolean;
  buildingAgeYears: number;
}

export interface InsuranceBreakdown {
  dwelling_insurance_percent: number;
  liability_insurance_percent: number;
  pmi_percent: number | null;
}

export interface InsuranceEstimationResult {
  propertyValue: number;
  /** Dwelling + liability. */
  estimatedAnnualInsurance: number;
  estimatedMonthlyInsurance: number;
  /** e.g. 0.005 for 0.5% of property value. */
  insuranceRatePercent: number;
  /** US only: true if loanToValuePercent > 0.80. */
  pmiRequired: boolean;
  estimatedAnnualPMI: number | null;
  /** estimatedAnnualInsurance + estimatedAnnualPMI (if applicable). */
  totalAnnualInsurance: number;
  insuranceBreakdown: InsuranceBreakdown;
  summary: string;
  disclaimer: string;
}
