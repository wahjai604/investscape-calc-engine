/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateSalePrice } from "../src/E28-Sales-Appreciation";

describe("E28: Sales Price Appreciation", () => {
  describe("calculateSalePrice", () => {
    it("flat_growth: compound appreciation over 5 years", () => {
      const result = calculateSalePrice({
        method: "flat_growth",
        originalPurchasePrice: 706000,
        appreciationRate: 0.05,
        holdPeriodYears: 5,
      });

      // 706000 * (1.05)^5 = 901,054.78 (verified via node, not hand-arithmetic)
      expect(result).toBeCloseTo(901054.78, 2);
    });

    it("flat_growth: 0% appreciation returns original price", () => {
      const result = calculateSalePrice({
        method: "flat_growth",
        originalPurchasePrice: 500000,
        appreciationRate: 0,
        holdPeriodYears: 10,
      });

      expect(result).toBeCloseTo(500000, 2);
    });

    it("cap_rate: NOI / cap rate", () => {
      const result = calculateSalePrice({
        method: "cap_rate",
        finalYearNOI: 100000,
        exitCapRate: 0.06,
      });

      // 100000 / 0.06 = 1,666,666.67
      expect(result).toBeCloseTo(1666666.67, 2);
    });

    it("cap_rate: typical residential case", () => {
      const result = calculateSalePrice({
        method: "cap_rate",
        finalYearNOI: 85010.72,
        exitCapRate: 0.05,
      });

      // 85010.72 / 0.05 = 1,700,214.40
      expect(result).toBeCloseTo(1700214.4, 2);
    });
  });
});
