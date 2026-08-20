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

import { calculatePTT } from "./E11-ptt";
import { PTTInput, AcquisitionStructureInput, AcquisitionStructureResult, ParcelPTTAllocation } from "./types";

/**
 * A new file rather than an extension of E11-ptt.ts: the acquisition-
 * structure layer (multi-parcel assembly aggregation, asset-purchase-vs-
 * bare-trust triggering logic, per-parcel allocation, two sourced
 * explanatory notes) is substantial enough on its own that folding it into
 * E11 would bloat a file whose existing bracket/FTHB math is real, tested,
 * and explicitly not to be touched. This module calls calculatePTT()
 * unmodified — it's a caller of E11, not a rewrite of it.
 */

function combinedPTTInput(input: AcquisitionStructureInput): PTTInput {
  return {
    purchasePrice: input.parcels.reduce((sum, p) => sum + p.purchasePrice, 0),
    country: input.country,
    province: input.province,
    isFTHB: input.isFTHB,
    fmv: input.parcels.reduce((sum, p) => sum + p.fmv, 0),
    propertySize_hectares: input.parcels.reduce((sum, p) => sum + p.propertySize_hectares, 0),
    hasSecondaryBuilding: input.parcels.some((p) => p.hasSecondaryBuilding),
    isPrincipalResidence: input.isPrincipalResidence,
  };
}

function allocateToParcels(
  parcels: AcquisitionStructureInput["parcels"],
  combinedPurchasePrice: number,
  combinedPTTAmount: number | null,
): ParcelPTTAllocation[] {
  return parcels.map((parcel) => {
    const allocatedPTT =
      combinedPTTAmount === null || combinedPurchasePrice === 0
        ? null
        : combinedPTTAmount * (parcel.purchasePrice / combinedPurchasePrice);

    return { id: parcel.id, purchasePrice: parcel.purchasePrice, fmv: parcel.fmv, allocatedPTT };
  });
}

const COMBINED_CALCULATION_NOTE =
  "BC assesses property transfer tax once per taxable transaction, not once per parcel. When multiple " +
  "parcels transfer to the same buyer as part of one transaction (or a series of related transfers within " +
  "a six-month window), the general PTT brackets apply to the parcels' COMBINED fair market value — not " +
  "summed independently per parcel. Source: gov.bc.ca's Property Transfer Tax Return Guide, 'Multiple " +
  "parcels' worked example (two parcels of $175,000 + $200,000 taxed together as one $375,000 transaction " +
  "= $5,500, not as two separately-bracketed calculations — which would under-tax the assembly by letting " +
  "each parcel re-claim the discounted 1% first-$200,000 bracket). This engine assumes every parcel passed " +
  "in belongs to that same single taxable transaction — see AcquisitionStructureInput.parcels' doc comment.";

function acquisitionStructureNote(structure: AcquisitionStructureInput["acquisitionStructure"]): string {
  if (structure === "asset_purchase") {
    return (
      "Asset purchase: legal title to every parcel registers directly to the buyer at the Land Title " +
      "Office — exactly the event BC's Property Transfer Tax Act taxes. combined.ptt_amount is payable at closing."
    );
  }

  return (
    "Bare-trust acquisition: BC's PTT applies only to registered transfers of LEGAL title at the Land " +
    "Title Office (unlike Ontario's equivalent tax, which also reaches beneficial transfers). A bare trust " +
    "holds legal title in a trustee while the buyer holds beneficial ownership (typically by owning the " +
    "trustee entity's shares); acquiring that beneficial interest — without registering a transfer of legal " +
    "title — does not trigger PTT. Source: BC PTT Act's legal-title-only scope, as described in 'The Naked " +
    "Truth About Bare Trusts' (cwilson.com) and confirmed still open by reporting as recent as April 2026 " +
    "(The Tyee, 'The NDP's Broken Promise to Close a Big Real Estate Tax Loophole'). combined.ptt_amount " +
    "above is a REFERENCE figure only — what would be owed if legal title transferred directly — and " +
    "pttCurrentlyTriggered is false because no such registration has occurred. This is a real, current " +
    "structure, not a deferral to a fixed future date: if legal title is ever later transferred out of the " +
    "bare trust, full PTT becomes payable at that time on the then-current fair market value. Modeling that " +
    "hypothetical future transaction is out of scope for this engine — rerun calculateAcquisitionStructure() " +
    "at that time rather than trusting a stale figure from today."
  );
}

/**
 * Combines a multi-parcel land assembly's real BC PTT liability (one
 * combined-fair-market-value calculation via calculatePTT(), per BC's
 * per-taxable-transaction rule — see combinedCalculationNote) with the
 * real, sourced asset-purchase-vs-bare-trust distinction in whether that
 * liability is actually triggered right now (see acquisitionStructureNote).
 */
export function calculateAcquisitionStructure(input: AcquisitionStructureInput): AcquisitionStructureResult {
  const combined = calculatePTT(combinedPTTInput(input));
  const combinedPurchasePrice = input.parcels.reduce((sum, p) => sum + p.purchasePrice, 0);
  const combinedFMV = input.parcels.reduce((sum, p) => sum + p.fmv, 0);

  return {
    parcels: allocateToParcels(input.parcels, combinedPurchasePrice, combined.ptt_amount),
    combined,
    combinedPurchasePrice,
    combinedFMV,
    acquisitionStructure: input.acquisitionStructure,
    pttCurrentlyTriggered: input.acquisitionStructure === "asset_purchase",
    combinedCalculationNote: COMBINED_CALCULATION_NOTE,
    acquisitionStructureNote: acquisitionStructureNote(input.acquisitionStructure),
  };
}
