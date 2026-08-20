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

import { PTTResult } from "./E11-ptt.types";

export interface AssemblyParcel {
  id: string;
  purchasePrice: number;
  fmv: number;
  propertySize_hectares: number;
  hasSecondaryBuilding: boolean;
}

/**
 * asset_purchase: legal title to every parcel registers directly to the
 * buyer — the ordinary case calculatePTT() (E11) already models.
 *
 * bare_trust: legal title is registered to a bare trustee while the buyer
 * holds beneficial ownership (typically by owning the trustee entity's
 * shares); acquiring that beneficial interest does not register a transfer
 * of legal title, and BC's PTT applies only to registered legal-title
 * transfers — see calculateAcquisitionStructure()'s doc comment for the
 * full sourced explanation.
 */
export type AcquisitionStructure = "asset_purchase" | "bare_trust";

export interface AcquisitionStructureInput {
  /**
   * All parcels here are assumed to belong to the SAME taxable transaction
   * (same buyer, one deal or a series of related transfers within BC's
   * six-month combined-transaction window) — see
   * calculateAcquisitionStructure()'s combinedCalculationNote. Parcels that
   * are actually unrelated transfers to different buyers, or outside that
   * window, should be run through calculatePTT() separately instead of
   * being assembled here.
   */
  parcels: AssemblyParcel[];
  country: "Canada" | "US";
  province: string;
  acquisitionStructure: AcquisitionStructure;
  /** Applied to the assembly as a whole (one buyer, one taxable transaction) — not per parcel. */
  isFTHB: boolean;
  isPrincipalResidence: boolean;
}

export interface ParcelPTTAllocation {
  id: string;
  purchasePrice: number;
  fmv: number;
  /**
   * This parcel's proportional share of `combined.ptt_amount`, allocated
   * by its share of the assembly's combined purchase price. Informational
   * only — BC assesses PTT once on the combined transaction (see
   * `combined` and combinedCalculationNote), not independently per parcel;
   * this is NOT a re-bracketed per-parcel calculation. null when
   * combined.ptt_amount is null (no calculable PTT — non-BC/US) or the
   * assembly's combined purchase price is 0.
   */
  allocatedPTT: number | null;
}

export interface AcquisitionStructureResult {
  parcels: ParcelPTTAllocation[];
  /**
   * The real BC PTT calculation (via calculatePTT() from E11, unmodified)
   * for this assembly: general/FTHB brackets applied once to the combined
   * purchase price/FMV of every parcel — the "as if legal title transferred
   * directly" reference figure. NOT adjusted for acquisitionStructure; see
   * pttCurrentlyTriggered for whether it's actually payable now.
   */
  combined: PTTResult;
  combinedPurchasePrice: number;
  combinedFMV: number;
  acquisitionStructure: AcquisitionStructure;
  /**
   * Whether combined.ptt_amount is actually payable now, given
   * acquisitionStructure. False for "bare_trust" — no legal-title transfer
   * is registered, so no PTT-triggering event has occurred yet. True for
   * "asset_purchase".
   */
  pttCurrentlyTriggered: boolean;
  /** Explains the combined-vs-per-parcel bracket rule for a multi-parcel assembly, and cites its source. */
  combinedCalculationNote: string;
  /** Explains why/whether PTT is triggered under the chosen acquisitionStructure, and cites its source. */
  acquisitionStructureNote: string;
}
