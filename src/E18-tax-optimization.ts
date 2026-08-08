import { calculateIRR } from "./E5-returns";
import { TaxOptimizationInput, TaxOptimizationResult } from "./types";
import { US_RESIDENTIAL_USEFUL_LIFE_YEARS, US_COMMERCIAL_USEFUL_LIFE_YEARS, CANADA_CCA_RATE } from "./utils/constants";

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
