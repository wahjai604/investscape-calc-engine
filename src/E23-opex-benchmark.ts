import { OpExPropertyType, LocationTier, OpExBenchmarkInput, OpExBreakdown, OpExBenchmarkResult } from "./types";

interface RateRange {
  min: number;
  max: number;
  label: string;
}

/**
 * Rates are the midpoint of each range the E26 spec gives — confirmed as
 * the intended rule by cross-checking against the spec's own test cases:
 * SFH (25-30% → 27.5%), Multifamily 5-20 (30-35% → 32.5%), and Retail/
 * Office (35-45% → 40%) all match their midpoint exactly in the worked
 * examples.
 *
 * The spec separately benchmarks Retail/Office (35-45%) and Industrial
 * (30-35%) under "commercial," but OpExPropertyType only has one generic
 * "commercial" value — there's no distinct "industrial" option to select
 * the latter. "commercial" maps to Retail/Office here, confirmed by the
 * spec's own "Commercial retail urban: 40% + 5% = 45%" test case; the
 * Industrial range is otherwise unreachable through this input shape.
 */
const BASE_RATE_RANGES: Record<OpExPropertyType, RateRange> = {
  sfh: { min: 0.25, max: 0.3, label: "SFH" },
  duplex: { min: 0.25, max: 0.3, label: "Duplex" },
  triplex: { min: 0.25, max: 0.3, label: "Triplex" },
  fourplex: { min: 0.25, max: 0.3, label: "Fourplex" },
  multifamily_5_20: { min: 0.3, max: 0.35, label: "Multifamily (5-20 units)" },
  multifamily_20plus: { min: 0.35, max: 0.4, label: "Multifamily (20+ units)" },
  commercial: { min: 0.35, max: 0.45, label: "Commercial (Retail/Office)" },
  mixed_use: { min: 0.4, max: 0.5, label: "Mixed-use" },
};

function baseRateFor(propertyType: OpExPropertyType): number {
  const range = BASE_RATE_RANGES[propertyType];
  return (range.min + range.max) / 2;
}

/** Flat percentage-point add/subtract, not multiplicative — confirmed by every location-tier test case in the E26 spec (e.g. "27.5% + 5% urban + 8% mgmt = 40.5%"). */
const LOCATION_TIER_ADJUSTMENT: Record<LocationTier, number> = {
  urban: 0.05,
  suburban: 0,
  rural: -0.05,
};

/**
 * No per-category benchmark percentages are given anywhere in the E26
 * spec — only an aggregate opex% per property type/tier, plus one
 * unlabeled illustrative breakdown example ("property_tax 8%, insurance
 * 3%, maintenance 10%, utilities 4%, mgmt 8% = 33% total") that doesn't
 * correspond to any of the spec's own numbered scenarios (none of their
 * computed totals equal 33%), so it isn't treated as a target to
 * reproduce. These shares — of the BASE rate only, before the location
 * tier adjustment and management fee are added — are a documented,
 * internally-consistent assumption using commonly-cited rough industry
 * proportions, not a figure derived from the spec's own data.
 */
const BASE_BREAKDOWN_SHARE = {
  propertyTax: 0.4,
  insurance: 0.15,
  maintenance: 0.35,
  utilities: 0.1,
};

export function calculateOpExBenchmark(input: OpExBenchmarkInput): OpExBenchmarkResult {
  const baseRate = baseRateFor(input.propertyType);
  const tierAdjustment = LOCATION_TIER_ADJUSTMENT[input.locationTier];
  const managementPercent = input.includePropertyManagement ? (input.propertyManagementPercent ?? 0) : 0;

  const opexPercentOfGrossRent = baseRate + tierAdjustment + managementPercent;
  const estimatedAnnualOpEx = input.grossAnnualRent * opexPercentOfGrossRent;

  // The location tier adjustment is split evenly between property tax and
  // maintenance — the two cost drivers the spec itself names for the urban
  // adjustment ("higher property tax, labor costs").
  const opexBreakdown: OpExBreakdown = {
    propertyTax_percent: baseRate * BASE_BREAKDOWN_SHARE.propertyTax + tierAdjustment / 2,
    insurance_percent: baseRate * BASE_BREAKDOWN_SHARE.insurance,
    maintenance_repair_percent: baseRate * BASE_BREAKDOWN_SHARE.maintenance + tierAdjustment / 2,
    utilities_percent: baseRate * BASE_BREAKDOWN_SHARE.utilities,
    vacancy_percent: 0,
    propertyManagement_percent: managementPercent,
  };

  const range = BASE_RATE_RANGES[input.propertyType];
  const summary =
    `${range.label} typical OpEx: ${(range.min * 100).toFixed(0)}-${(range.max * 100).toFixed(0)}% of gross rent. ` +
    `This deal: $${estimatedAnnualOpEx.toFixed(2)}/year (${(opexPercentOfGrossRent * 100).toFixed(1)}% of gross rent).`;

  return {
    propertyType: input.propertyType,
    opexPercentOfGrossRent,
    estimatedAnnualOpEx,
    opexBreakdown,
    summary,
    disclaimer: "OpEx varies by property condition, age, location. Consult contractor estimates.",
  };
}
