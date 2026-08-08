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

import { PTTInput, PTTResult } from "./types";
import {
  BRACKET_1_LIMIT,
  BRACKET_2_LIMIT,
  RESIDENTIAL_SURCHARGE_THRESHOLD,
  BRACKET_1_RATE,
  BRACKET_2_RATE,
  BRACKET_3_RATE,
  RESIDENTIAL_SURCHARGE_RATE,
  FTHB_FMV_FULL_EXEMPTION_MAX,
  FTHB_FMV_PHASEOUT_MAX,
  FTHB_EXEMPTION_PRICE_THRESHOLD,
  FTHB_MAX_PROPERTY_SIZE_HECTARES,
} from "./utils/constants";

/**
 * BC General PTT: marginal brackets (1% / 2% / 3%) plus a 2% surcharge on the
 * residential portion above $3,000,000, layered on top of (not replacing)
 * the 3% top bracket.
 */
function generalPTT(purchasePrice: number): number {
  const bracket1 = Math.min(purchasePrice, BRACKET_1_LIMIT) * BRACKET_1_RATE;
  const bracket2 = Math.max(0, Math.min(purchasePrice, BRACKET_2_LIMIT) - BRACKET_1_LIMIT) * BRACKET_2_RATE;
  const bracket3 = Math.max(0, purchasePrice - BRACKET_2_LIMIT) * BRACKET_3_RATE;
  const surcharge = Math.max(0, purchasePrice - RESIDENTIAL_SURCHARGE_THRESHOLD) * RESIDENTIAL_SURCHARGE_RATE;

  return bracket1 + bracket2 + bracket3 + surcharge;
}

function generalPTTBreakdown(purchasePrice: number): string {
  const bracket1 = Math.min(purchasePrice, BRACKET_1_LIMIT) * BRACKET_1_RATE;
  const bracket2 = Math.max(0, Math.min(purchasePrice, BRACKET_2_LIMIT) - BRACKET_1_LIMIT) * BRACKET_2_RATE;
  const bracket3 = Math.max(0, purchasePrice - BRACKET_2_LIMIT) * BRACKET_3_RATE;
  const surcharge = Math.max(0, purchasePrice - RESIDENTIAL_SURCHARGE_THRESHOLD) * RESIDENTIAL_SURCHARGE_RATE;

  const parts = [`1% on first $200,000 = $${bracket1.toFixed(2)}`];
  if (bracket2 > 0) parts.push(`2% on $200,001-$2,000,000 portion = $${bracket2.toFixed(2)}`);
  if (bracket3 > 0) parts.push(`3% on $2,000,001+ portion = $${bracket3.toFixed(2)}`);
  if (surcharge > 0) parts.push(`+2% residential surcharge on portion over $3,000,000 = $${surcharge.toFixed(2)}`);

  return parts.join("; ");
}

/**
 * Linear phase-out of the FTHB exemption between $835,000 and $860,000 FMV:
 * 1 at or below the full-exemption threshold, 0 at or above the phase-out
 * ceiling, straight-line in between. This is also reused (per design intent)
 * as the proration for the hasSecondaryBuilding / oversized-lot case below,
 * since the input model has no improvement-value split to compute BC's real
 * secondary-building proration from.
 */
function fmvPhaseOutProportion(fmv: number): number {
  if (fmv <= FTHB_FMV_FULL_EXEMPTION_MAX) return 1;
  if (fmv >= FTHB_FMV_PHASEOUT_MAX) return 0;
  return (FTHB_FMV_PHASEOUT_MAX - fmv) / (FTHB_FMV_PHASEOUT_MAX - FTHB_FMV_FULL_EXEMPTION_MAX);
}

/**
 * BC First Time Home Buyers' Program PTT exemption, layered on top of the
 * general PTT calculation. Several real eligibility criteria (citizenship,
 * 1+ year BC residency, never having owned a principal residence, and
 * residential-improvements-only use) aren't modeled as inputs and are
 * assumed true per spec — only isFTHB, isPrincipalResidence, fmv,
 * propertySize_hectares, and hasSecondaryBuilding are actually evaluated.
 */
export function calculateBCPTT(
  purchasePrice: number,
  isFTHB: boolean,
  fmv: number,
  propertySize_hectares: number,
  hasSecondaryBuilding: boolean,
  isPrincipalResidence: boolean,
): PTTResult {
  const fullPTT = generalPTT(purchasePrice);
  const generalBreakdown = generalPTTBreakdown(purchasePrice);

  const baseEligible = isFTHB && isPrincipalResidence;
  if (!baseEligible) {
    return {
      ptt_amount: fullPTT,
      exemption_type: "none",
      exemption_amount: 0,
      breakdown: `No FTHB exemption (not a first-time home buyer purchasing a principal residence). ${generalBreakdown}.`,
    };
  }

  // Full exemption covers tax on the lesser of the purchase price or the
  // $500,000 threshold — if the price is under threshold, this equals the
  // entire general PTT, zeroing it out.
  const maxExemption = Math.min(fullPTT, generalPTT(Math.min(purchasePrice, FTHB_EXEMPTION_PRICE_THRESHOLD)));

  const sizeExceedsLimit = propertySize_hectares > FTHB_MAX_PROPERTY_SIZE_HECTARES;
  const fullyEligible = fmv <= FTHB_FMV_FULL_EXEMPTION_MAX && !sizeExceedsLimit && !hasSecondaryBuilding;

  if (fullyEligible) {
    return {
      ptt_amount: fullPTT - maxExemption,
      exemption_type: "full",
      exemption_amount: maxExemption,
      breakdown: `Full FTHB exemption: tax on the first $${FTHB_EXEMPTION_PRICE_THRESHOLD.toLocaleString()} of purchase price is exempt ($${maxExemption.toFixed(2)}). ${generalBreakdown}.`,
    };
  }

  const proportion = fmvPhaseOutProportion(fmv);
  if (proportion <= 0) {
    return {
      ptt_amount: fullPTT,
      exemption_type: "none",
      exemption_amount: 0,
      breakdown: `No FTHB exemption: FMV of $${fmv.toLocaleString()} is at or above the $${FTHB_FMV_PHASEOUT_MAX.toLocaleString()} phase-out ceiling. ${generalBreakdown}.`,
    };
  }

  const exemptionAmount = maxExemption * proportion;
  const reason = sizeExceedsLimit
    ? `property exceeds ${FTHB_MAX_PROPERTY_SIZE_HECTARES} hectares`
    : hasSecondaryBuilding
      ? "property has a secondary building"
      : `FMV of $${fmv.toLocaleString()} is within the phase-out band`;

  return {
    ptt_amount: fullPTT - exemptionAmount,
    exemption_type: "partial",
    exemption_amount: exemptionAmount,
    breakdown: `Partial FTHB exemption (${(proportion * 100).toFixed(1)}% of the full $${maxExemption.toFixed(2)} exemption = $${exemptionAmount.toFixed(2)}) — ${reason}. ${generalBreakdown}.`,
  };
}

/** The US has no federal property transfer tax; any transfer tax is state/county-level and out of scope here. */
export function calculateUSPTT(): PTTResult {
  return {
    ptt_amount: null,
    exemption_type: "none",
    exemption_amount: 0,
    breakdown: "US has no federal PTT",
  };
}

/**
 * Dispatches on country/province: US has no federal PTT, BC has the general
 * + FTHB logic implemented here, and every other province is out of scope
 * (each has its own distinct transfer tax regime this module doesn't model).
 */
export function calculatePTT(input: PTTInput): PTTResult {
  if (input.country === "US") {
    return calculateUSPTT();
  }

  if (input.province.trim().toUpperCase() !== "BC") {
    return {
      ptt_amount: null,
      exemption_type: "none",
      exemption_amount: 0,
      breakdown: "Provincial PTT varies by province",
    };
  }

  return calculateBCPTT(
    input.purchasePrice,
    input.isFTHB,
    input.fmv,
    input.propertySize_hectares,
    input.hasSecondaryBuilding,
    input.isPrincipalResidence,
  );
}
