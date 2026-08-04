import { calculateIRR } from "./returns";

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

const US_RESIDENTIAL_USEFUL_LIFE_YEARS = 27.5;
const US_COMMERCIAL_USEFUL_LIFE_YEARS = 39;
/** CCA Class 1 (most residential and commercial rental buildings) — the spec only gives a residential rate, so this is applied to commercial too in the absence of a distinct rate; still $0 for land. */
const CANADA_CCA_RATE = 0.04;

interface DepreciationResult {
  annualDepreciation: number;
  totalDepreciationOverHold: number;
}

/**
 * US: straight-line over the property type's useful life (27.5yr
 * residential, 39yr commercial) — a genuinely constant annual figure.
 * Canada: CCA Class 1 declining balance at 4%/year, which is NOT constant
 * — each year's claim is 4% of the shrinking undepreciated balance, so
 * annualDepreciation here is totalDepreciationOverHold / holdPeriodYears
 * (an average), not a flat per-year amount like the US case. Land never
 * depreciates in either country.
 */
function computeDepreciation(input: TaxOptimizationInput): DepreciationResult {
  if (input.propertyType === "land" || input.improvementValue <= 0) {
    return { annualDepreciation: 0, totalDepreciationOverHold: 0 };
  }

  if (input.country === "US") {
    const usefulLifeYears = input.propertyType === "commercial" ? US_COMMERCIAL_USEFUL_LIFE_YEARS : US_RESIDENTIAL_USEFUL_LIFE_YEARS;
    const annualDepreciation = input.improvementValue / usefulLifeYears;
    return { annualDepreciation, totalDepreciationOverHold: annualDepreciation * input.holdPeriodYears };
  }

  let balance = input.improvementValue;
  let totalDepreciationOverHold = 0;
  for (let year = 1; year <= input.holdPeriodYears; year++) {
    const yearDepreciation = balance * CANADA_CCA_RATE;
    totalDepreciationOverHold += yearDepreciation;
    balance -= yearDepreciation;
  }

  return { annualDepreciation: totalDepreciationOverHold / input.holdPeriodYears, totalDepreciationOverHold };
}

/** [-initialEquity, NOI repeated holdPeriodYears times, with exitAmount added to the final year]. */
function buildSeries(input: TaxOptimizationInput, exitAmount: number): number[] {
  const series = [-input.initialEquity, ...Array<number>(input.holdPeriodYears).fill(input.annualNetOperatingIncome)];
  series[series.length - 1] += exitAmount;
  return series;
}

/**
 * Recapture double-counting fix: the source spec's own formulas for
 * depreciationRecapture/depreciationRecaptureTax conflicted with each
 * other (one squared depreciationRecaptureRate, the other chained
 * depreciationRecaptureRate into ordinaryIncomeRate), and neither avoided
 * taxing the depreciation-driven portion of the gain twice (once via
 * capitalGainsTax on the full gain, again via a separate recapture tax on
 * top). This implements the standard, non-double-counted split instead:
 * the gain is divided into a recaptured portion (capped at accumulated
 * depreciation, taxed once at depreciationRecaptureRate) and a remaining
 * portion (taxed at capitalGainsTaxRate) — mirroring how real Section 1250
 * recapture works, and matching depreciationRecaptureRate's "typically
 * 0.25" description (the real-world cap on unrecaptured §1250 gain).
 */
export function calculateTaxOptimization(input: TaxOptimizationInput): TaxOptimizationResult {
  const { annualDepreciation, totalDepreciationOverHold } = computeDepreciation(input);
  const taxSavingsFromDepreciation = totalDepreciationOverHold * input.ordinaryIncomeRate;

  const costBasis = input.purchasePrice - totalDepreciationOverHold;
  const capitalGain = input.projectedSalePrice - costBasis;

  const depreciationRecapture = Math.min(totalDepreciationOverHold, Math.max(capitalGain, 0));
  const remainingCapitalGain = capitalGain - depreciationRecapture;

  const depreciationRecaptureTax = depreciationRecapture * input.depreciationRecaptureRate;
  const capitalGainsTax = remainingCapitalGain * input.capitalGainsTaxRate;
  const totalTaxLiability = capitalGainsTax + depreciationRecaptureTax;

  const netProceeds = input.projectedSalePrice - input.remainingLoanBalance - totalTaxLiability;

  const preTaxExitAmount = input.projectedSalePrice - input.remainingLoanBalance;
  const preTaxIRR = calculateIRR(buildSeries(input, preTaxExitAmount));
  const afterTaxIRR = calculateIRR(buildSeries(input, netProceeds));

  // Canada has no like-kind exchange equivalent — only a principal
  // residence exemption, which doesn't apply to investment property.
  const is1031Eligible = input.country === "US";

  const summary =
    `Depreciation saves $${(annualDepreciation * input.ordinaryIncomeRate).toFixed(2)}/year. ` +
    `Tax due at sale: $${totalTaxLiability.toFixed(2)}. After-tax IRR: ${(afterTaxIRR * 100).toFixed(2)}%.`;

  return {
    annualDepreciation,
    totalDepreciationOverHold,
    taxSavingsFromDepreciation,
    capitalGain,
    capitalGainsTax,
    depreciationRecapture,
    depreciationRecaptureTax,
    totalTaxLiability,
    netProceeds,
    preTaxIRR,
    afterTaxIRR,
    is1031Eligible,
    summary,
  };
}
