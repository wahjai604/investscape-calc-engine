/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateAcquisitionStructure } from "../src/E82-acquisition-structure";
import { AcquisitionStructureInput } from "../src/types";

// Straight from gov.bc.ca's Property Transfer Tax Return Guide's own
// "multiple parcels" worked example: two parcels of $175,000 and $200,000
// FMV/price, same buyer, one transaction. Taxed TOGETHER as $375,000:
// 1% on first $200,000 = $2,000, 2% on the remaining $175,000 = $3,500,
// total $5,500 — NOT two independently-bracketed calculations (which would
// give 1% × 175,000 + 1% × 200,000 = $3,750, under-taxing the assembly by
// letting each parcel re-claim the discounted first-$200,000 bracket).
const twoParcelAssembly: AcquisitionStructureInput = {
  parcels: [
    { id: "parcel-a", purchasePrice: 175000, fmv: 175000, propertySize_hectares: 0.1, hasSecondaryBuilding: false },
    { id: "parcel-b", purchasePrice: 200000, fmv: 200000, propertySize_hectares: 0.1, hasSecondaryBuilding: false },
  ],
  country: "Canada",
  province: "BC",
  acquisitionStructure: "asset_purchase",
  isFTHB: false,
  isPrincipalResidence: false,
};

describe("calculateAcquisitionStructure", () => {
  describe("2-parcel assembly, one buyer (gov.bc.ca's own worked example)", () => {
    const result = calculateAcquisitionStructure(twoParcelAssembly);

    it("taxes the combined $375,000 fair market value together, matching the government's $5,500 figure", () => {
      expect(result.combinedPurchasePrice).toBe(375000);
      expect(result.combined.ptt_amount).toBeCloseTo(5500, 2);
    });

    it("differs from (and exceeds) the naive per-parcel-separate-bracket sum, proving that approach would be wrong", () => {
      const naiveSeparateSum = 175000 * 0.01 + 200000 * 0.01; // both parcels wrongly re-claiming the 1% bracket
      expect(naiveSeparateSum).toBeCloseTo(3750, 2);
      expect(result.combined.ptt_amount).not.toBeCloseTo(naiveSeparateSum, 2);
    });

    it("allocates the combined PTT back to each parcel proportionally, summing to the combined total", () => {
      const [parcelA, parcelB] = result.parcels;
      expect(parcelA.allocatedPTT).toBeCloseTo(5500 * (175000 / 375000), 2);
      expect(parcelB.allocatedPTT).toBeCloseTo(5500 * (200000 / 375000), 2);
      expect((parcelA.allocatedPTT ?? 0) + (parcelB.allocatedPTT ?? 0)).toBeCloseTo(5500, 2);
    });

    it("cites the combined-vs-per-parcel bracket rule in combinedCalculationNote", () => {
      expect(result.combinedCalculationNote).toMatch(/combined fair market value/i);
      expect(result.combinedCalculationNote).toMatch(/gov\.bc\.ca/i);
    });
  });

  describe("asset-purchase case", () => {
    it("PTT is currently triggered — payable at closing", () => {
      const result = calculateAcquisitionStructure({ ...twoParcelAssembly, acquisitionStructure: "asset_purchase" });

      expect(result.pttCurrentlyTriggered).toBe(true);
      expect(result.combined.ptt_amount).toBeCloseTo(5500, 2);
      expect(result.acquisitionStructureNote).toMatch(/legal title/i);
      expect(result.acquisitionStructureNote).toMatch(/payable at closing/i);
    });
  });

  describe("bare-trust case", () => {
    it("PTT is NOT currently triggered, but combined.ptt_amount still reports the real reference figure rather than being hidden or zeroed", () => {
      const result = calculateAcquisitionStructure({ ...twoParcelAssembly, acquisitionStructure: "bare_trust" });

      expect(result.pttCurrentlyTriggered).toBe(false);
      // The reference calculation is unchanged from the asset-purchase case
      // — bare trust changes whether it's owed now, not what it would be.
      expect(result.combined.ptt_amount).toBeCloseTo(5500, 2);
    });

    it("cites the real, sourced bare-trust rule (legal title vs. beneficial interest) rather than fabricating a deferral schedule", () => {
      const result = calculateAcquisitionStructure({ ...twoParcelAssembly, acquisitionStructure: "bare_trust" });

      expect(result.acquisitionStructureNote).toMatch(/legal title/i);
      expect(result.acquisitionStructureNote).toMatch(/beneficial/i);
      expect(result.acquisitionStructureNote).toMatch(/reference figure/i);
      // Explicitly declines to model the hypothetical future transfer-out-of-trust event.
      expect(result.acquisitionStructureNote).toMatch(/out of scope/i);
    });

    it("acquisitionStructure and pttCurrentlyTriggered are the only fields that differ from the asset-purchase run on identical parcels", () => {
      const assetPurchase = calculateAcquisitionStructure({ ...twoParcelAssembly, acquisitionStructure: "asset_purchase" });
      const bareTrust = calculateAcquisitionStructure({ ...twoParcelAssembly, acquisitionStructure: "bare_trust" });

      expect(bareTrust.combined).toEqual(assetPurchase.combined);
      expect(bareTrust.parcels).toEqual(assetPurchase.parcels);
      expect(bareTrust.combinedPurchasePrice).toBe(assetPurchase.combinedPurchasePrice);
      expect(bareTrust.pttCurrentlyTriggered).not.toBe(assetPurchase.pttCurrentlyTriggered);
    });
  });

  it("a single-parcel assembly reduces to an ordinary calculatePTT() call on that one parcel", () => {
    const single: AcquisitionStructureInput = {
      parcels: [{ id: "solo", purchasePrice: 900000, fmv: 900000, propertySize_hectares: 0.2, hasSecondaryBuilding: false }],
      country: "Canada",
      province: "BC",
      acquisitionStructure: "asset_purchase",
      isFTHB: false,
      isPrincipalResidence: false,
    };
    const result = calculateAcquisitionStructure(single);

    // 1% × 200,000 + 2% × 700,000 = 2,000 + 14,000 = 16,000
    expect(result.combined.ptt_amount).toBeCloseTo(16000, 2);
    expect(result.parcels[0].allocatedPTT).toBeCloseTo(16000, 2);
  });
});
