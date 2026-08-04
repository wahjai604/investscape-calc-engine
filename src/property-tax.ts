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

interface JurisdictionRates {
  displayName: string;
  residential: number;
  commercial: number;
}

/**
 * Where the E25 spec gave a range (e.g. "BC: residential 0.8-0.9%"), the
 * rate here is the range's midpoint — confirmed as the intended rule by
 * cross-checking against the spec's own test cases: BC residential
 * (0.8-0.9% → 0.85%) and NY (1.5-2.0% → 1.75%) both match their midpoint
 * exactly. BC commercial is the one exception: its stated test case
 * (1.2-1.5% → "1.3%" / $13,000 on $1M) doesn't match the midpoint
 * (1.35% / $13,500) — implemented as 1.35% for consistency with the
 * pattern every other range follows, not as 1.3%. See
 * calculatePropertyTax's JSDoc.
 */
const CANADA_RATES: Record<string, JurisdictionRates> = {
  BC: { displayName: "BC", residential: 0.0085, commercial: 0.0135 },
  ON: { displayName: "ON", residential: 0.0065, commercial: 0.011 },
  AB: { displayName: "AB", residential: 0.0055, commercial: 0.009 },
};
const CANADA_DEFAULT_RATES: Pick<JurisdictionRates, "residential" | "commercial"> = { residential: 0.007, commercial: 0.01 };

const US_RATES: Record<string, JurisdictionRates> = {
  CA: { displayName: "California", residential: 0.0076, commercial: 0.0076 },
  TX: { displayName: "Texas", residential: 0.0075, commercial: 0.01 },
  AZ: { displayName: "Arizona", residential: 0.0065, commercial: 0.0085 },
  NY: { displayName: "New York", residential: 0.0175, commercial: 0.0175 },
  FL: { displayName: "Florida", residential: 0.008, commercial: 0.01 },
};
const US_DEFAULT_RATES: Pick<JurisdictionRates, "residential" | "commercial"> = { residential: 0.009, commercial: 0.011 };

/**
 * Only residential/commercial rates are given per jurisdiction — there's
 * no data for "industrial" or "land". Both fall back to the jurisdiction's
 * commercial rate, since real property tax systems typically tax
 * industrial and undeveloped/vacant land under the same non-residential
 * class as commercial, absent more specific data.
 */
function rateForPropertyType(rates: Pick<JurisdictionRates, "residential" | "commercial">, propertyType: PropertyType): number {
  return propertyType === "residential" ? rates.residential : rates.commercial;
}

interface RateLookup {
  effectiveTaxRate: number;
  jurisdiction: string;
  taxRateSource: TaxRateSource;
}

/**
 * taxRateSource: "provincial_average" for a recognized Canadian province
 * (the spec's Canada table is genuinely provincial). "county_average" for
 * a recognized US state — the spec's own US table is state-level, not
 * county-level, but "county_average" is the closest fit among the three
 * given source labels (US property tax is conventionally county-
 * administered even though this simplified table only reaches state
 * granularity) and there's no "state_average" option to choose instead.
 * "estimated" for any unrecognized province/state, in either country.
 */
function lookupRates(input: PropertyTaxInput): RateLookup {
  if (input.country === "Canada") {
    const code = input.province.trim().toUpperCase();
    const match = CANADA_RATES[code];

    if (match) {
      return { effectiveTaxRate: rateForPropertyType(match, input.propertyType), jurisdiction: match.displayName, taxRateSource: "provincial_average" };
    }
    return { effectiveTaxRate: rateForPropertyType(CANADA_DEFAULT_RATES, input.propertyType), jurisdiction: input.province, taxRateSource: "estimated" };
  }

  const code = input.state.trim().toUpperCase();
  const match = US_RATES[code];

  if (match) {
    return { effectiveTaxRate: rateForPropertyType(match, input.propertyType), jurisdiction: match.displayName, taxRateSource: "county_average" };
  }
  return { effectiveTaxRate: rateForPropertyType(US_DEFAULT_RATES, input.propertyType), jurisdiction: input.state, taxRateSource: "estimated" };
}

const BASE_DISCLAIMER = "Tax rates vary by county/municipality. Consult local assessor.";
const NEW_CONSTRUCTION_NOTE =
  " This property is flagged as new construction — some jurisdictions offer temporary exemptions or phased-in assessments that aren't reflected in this estimate; confirm with the local assessor.";

export function calculatePropertyTax(input: PropertyTaxInput): PropertyTaxResult {
  const { effectiveTaxRate, jurisdiction, taxRateSource } = lookupRates(input);

  const estimatedAnnualTax = input.propertyValue * effectiveTaxRate;
  const taxPerMonth = estimatedAnnualTax / 12;

  const disclaimer = BASE_DISCLAIMER + (input.isNewConstruction ? NEW_CONSTRUCTION_NOTE : "");

  const summary = `Property tax estimated at $${estimatedAnnualTax.toFixed(2)}/year ($${taxPerMonth.toFixed(2)}/month) based on a ${(effectiveTaxRate * 100).toFixed(2)}% rate in ${jurisdiction}.`;

  return {
    propertyValue: input.propertyValue,
    effectiveTaxRate,
    estimatedAnnualTax,
    taxPerMonth,
    jurisdiction,
    taxRateSource,
    disclaimer,
    summary,
  };
}
