export interface TaxOptimizationInput {
  purchasePrice: number;
  propertyType: "residential" | "commercial" | "land";
  /** Building value, excludes land — the only portion that depreciates. */
  improvementValue: number;
  /** purchasePrice - improvementValue. */
  landValue: number;
  /** NOI before depreciation. Held constant for every year of the hold — this input has no per-year growth rate or financing terms, so annualNetOperatingIncome doubles as the flat annual cash flow used for IRR (see preTaxIRR/afterTaxIRR). */
  annualNetOperatingIncome: number;
  holdPeriodYears: number;
  /** Federal + state/provincial combined, e.g. 0.25. */
  capitalGainsTaxRate: number;
  /** Marginal tax rate, e.g. 0.35. */
  ordinaryIncomeRate: number;
  /** Typically 0.25 (matches the real-world 25% cap on US unrecaptured Section 1250 gain). */
  depreciationRecaptureRate: number;
  country: "Canada" | "US";
  /** Down payment + closing costs. */
  initialEquity: number;
  /** At exit. */
  projectedSalePrice: number;
  /** At exit. */
  remainingLoanBalance: number;
}

export interface TaxOptimizationResult {
  /** IRS straight-line depreciation per year (US), or the *average* annual CCA claim over the hold period (Canada — see the JSDoc on calculateTaxOptimization for why Canada's real figure isn't constant year to year). 0 for land. */
  annualDepreciation: number;
  /** Cumulative depreciation deduction over the whole hold period. */
  totalDepreciationOverHold: number;
  /** totalDepreciationOverHold × ordinaryIncomeRate. */
  taxSavingsFromDepreciation: number;
  /** Total gain: projectedSalePrice - costBasis, where costBasis = purchasePrice - totalDepreciationOverHold. Includes both the recaptured-depreciation portion and the remaining capital-gain portion (see depreciationRecapture). */
  capitalGain: number;
  /** Tax on the portion of capitalGain NOT attributable to depreciation (capitalGain - depreciationRecapture) × capitalGainsTaxRate. */
  capitalGainsTax: number;
  /**
   * The portion of capitalGain attributable to depreciation taken:
   * min(totalDepreciationOverHold, max(capitalGain, 0)) — capped so it can
   * never exceed the total gain (a property that hasn't gained in value
   * has nothing to recapture, however much depreciation was claimed), and
   * floored at 0 if there's no gain at all.
   */
  depreciationRecapture: number;
  /** depreciationRecapture × depreciationRecaptureRate. */
  depreciationRecaptureTax: number;
  /** capitalGainsTax + depreciationRecaptureTax. */
  totalTaxLiability: number;
  /** projectedSalePrice - remainingLoanBalance - totalTaxLiability. */
  netProceeds: number;
  /** IRR ignoring totalTaxLiability entirely (exit proceeds = projectedSalePrice - remainingLoanBalance). */
  preTaxIRR: number;
  /** IRR using netProceeds (tax-adjusted) as the exit-year proceeds instead. */
  afterTaxIRR: number;
  /**
   * true only when country is "US" — Canada has no like-kind exchange
   * equivalent (see calculateTaxOptimization's JSDoc). This reflects
   * structural/country eligibility only: TaxOptimizationInput has no
   * closing-date or replacement-property-identification field, so the
   * actual 180-day timing requirement can't be evaluated from this input.
   */
  is1031Eligible: boolean;
  summary: string;
}
