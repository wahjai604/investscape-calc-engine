/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateRentalWaterfall } from "../src/E21-rental-waterfall";
import { RentalWaterfallInput, RentalUnit } from "../src/types";

describe("calculateRentalWaterfall", () => {
  describe("1. single stabilized unit (no ramp)", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 60,
      units: [{ unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 }],
    };
    const result = calculateRentalWaterfall(input);

    it("every month shows the same $2,000 gross / $100 vacancy / $1,900 effective figures", () => {
      expect(result.cashFlowSeries).toHaveLength(60);
      expect(result.cashFlowSeries.every((m) => m.totalGrossRent === 2000)).toBe(true);
      expect(result.cashFlowSeries.every((m) => m.totalVacancyAllowance === 100)).toBe(true);
      expect(result.cashFlowSeries.every((m) => m.totalEffectiveRent === 1900)).toBe(true);
    });

    it("every year shows $24K gross / $1.2K vacancy / $22.8K effective", () => {
      expect(result.annualSummary).toHaveLength(5);
      for (const year of result.annualSummary) {
        expect(year.grossRentCollected).toBe(24000);
        expect(year.vacancyLoss).toBe(1200);
        expect(year.effectiveIncome).toBe(22800);
        expect(year.rampedInUnits).toBe(1);
      }
    });

    it('rampImpact text reads "No ramp — immediate occupancy from month 1."', () => {
      expect(result.unitMetrics[0].rampImpact).toBe("No ramp — immediate occupancy from month 1.");
    });
  });

  describe("2. two units, staggered online", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 60,
      units: [
        { unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
        // vacancyRatePercent wasn't specified for Unit B in the task brief —
        // 5% is used here (matching Unit A) for a clean, documented fixture.
        { unitId: "Unit B", monthlyRent: 1500, vacancyRatePercent: 0.05, rampStartMonth: 7, rampEndMonth: 13, occupancyDuringRamp: 0.5 },
      ],
    };
    const result = calculateRentalWaterfall(input);

    it("months 1-6: Unit A only ($1,900 effective)", () => {
      for (const month of result.cashFlowSeries.slice(0, 6)) {
        expect(month.totalGrossRent).toBe(2000);
        expect(month.totalEffectiveRent).toBe(1900);
      }
    });

    it("months 7-12: A + B ramping ($1,900 + $750 = $2,650 effective)", () => {
      for (const month of result.cashFlowSeries.slice(6, 12)) {
        expect(month.totalGrossRent).toBe(3500);
        expect(month.totalEffectiveRent).toBe(2650);
      }
    });

    it("month 13+: A + B stabilized — $3,325 effective (not the brief's ~$3.35K estimate, since Unit B's stabilized vacancy rate wasn't specified there)", () => {
      for (const month of result.cashFlowSeries.slice(12)) {
        expect(month.totalEffectiveRent).toBeCloseTo(3325, 6);
      }
    });

    it("newUnitsThisMonth flags Unit A at month 1 and Unit B at month 7, and only those months", () => {
      expect(result.cashFlowSeries[0].newUnitsThisMonth).toEqual(["Unit A"]);
      expect(result.cashFlowSeries[6].newUnitsThisMonth).toEqual(["Unit B"]);

      const monthsWithNewUnits = result.cashFlowSeries.filter((m) => m.newUnitsThisMonth.length > 0).map((m) => m.month);
      expect(monthsWithNewUnits).toEqual([1, 7]);
    });

    it("annualSummary shows the ramp progression: rampedInUnits goes from 1 (year 1, B still ramping) to 2 (year 2+, both stabilized)", () => {
      expect(result.annualSummary[0].rampedInUnits).toBe(1);
      expect(result.annualSummary[1].rampedInUnits).toBe(2);
      expect(result.annualSummary[4].rampedInUnits).toBe(2);

      // Year 1 = 6 months at 1,900 + 6 months at 2,650 = 27,300.
      expect(result.annualSummary[0].effectiveIncome).toBe(27300);
      // Year 2+ = 12 months at 3,325 = 39,900.
      expect(result.annualSummary[1].effectiveIncome).toBe(39900);
    });
  });

  describe("3. complex 3-unit phased occupancy", () => {
    const units: RentalUnit[] = [
      { unitId: "Unit A", monthlyRent: 1500, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
      { unitId: "Unit B", monthlyRent: 1800, vacancyRatePercent: 0.05, rampStartMonth: 4, rampEndMonth: 10, occupancyDuringRamp: 0.5 },
      { unitId: "Unit C", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 13, rampEndMonth: 19, occupancyDuringRamp: 0.3 },
    ];
    const input: RentalWaterfallInput = { analysisMonths: 24, units };
    const result = calculateRentalWaterfall(input);

    it("newUnitsThisMonth flags each unit's actual arrival month (1, 4, 13)", () => {
      expect(result.cashFlowSeries[0].newUnitsThisMonth).toEqual(["Unit A"]);
      expect(result.cashFlowSeries[3].newUnitsThisMonth).toEqual(["Unit B"]);
      expect(result.cashFlowSeries[12].newUnitsThisMonth).toEqual(["Unit C"]);
    });

    it("the stepped curve transitions correctly through each phase", () => {
      // Month 3: A only, stabilized. 1500*0.95 = 1425.
      expect(result.cashFlowSeries[2].totalEffectiveRent).toBeCloseTo(1425, 6);
      // Month 4: A + B ramping. 1425 + 1800*0.5 = 2325.
      expect(result.cashFlowSeries[3].totalEffectiveRent).toBeCloseTo(2325, 6);
      // Month 10: A + B now stabilized (ramp ended month 10). 1425 + 1800*0.95 = 3135.
      expect(result.cashFlowSeries[9].totalEffectiveRent).toBeCloseTo(3135, 6);
      // Month 13: A + B stabilized + C ramping. 3135 + 2000*0.3 = 3735.
      expect(result.cashFlowSeries[12].totalEffectiveRent).toBeCloseTo(3735, 6);
      // Month 19: all three stabilized (C's ramp ends month 19). 3135 + 2000*0.95 = 5035.
      expect(result.cashFlowSeries[18].totalEffectiveRent).toBeCloseTo(5035, 6);
      // Month 24: unchanged from month 19 — full stabilization holds through the end of the window.
      expect(result.cashFlowSeries[23].totalEffectiveRent).toBeCloseTo(5035, 6);
    });

    it("each ramp period's rampedInUnits count progresses correctly by year", () => {
      // Year 1 (through month 12): A and B fully ramped, C hasn't started yet.
      expect(result.annualSummary[0].rampedInUnits).toBe(2);
      // Year 2 (through month 24): all three fully ramped (C's ramp ends month 19, well within year 2).
      expect(result.annualSummary[1].rampedInUnits).toBe(3);
    });
  });

  describe("4. zero vacancy (100% occupancy)", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 12,
      units: [{ unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 }],
    };
    const result = calculateRentalWaterfall(input);

    it("no vacancy deduction: $24K gross = $24K effective, $0 vacancy loss", () => {
      expect(result.annualSummary[0].grossRentCollected).toBe(24000);
      expect(result.annualSummary[0].vacancyLoss).toBe(0);
      expect(result.annualSummary[0].effectiveIncome).toBe(24000);
    });
  });

  describe("5. multiple vacancy rates (per-unit, not uniform)", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 12,
      units: [
        { unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
        { unitId: "Unit B", monthlyRent: 1500, vacancyRatePercent: 0.03, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
      ],
    };
    const result = calculateRentalWaterfall(input);

    it("each unit's vacancy loss uses its own rate, not a shared/uniform one", () => {
      // Unit A: 2000 * 0.05 = 100. Unit B: 1500 * 0.03 = 45. Total = 145, not 2*some-single-rate.
      expect(result.cashFlowSeries[0].totalVacancyAllowance).toBe(145);

      const wrongIfUniformAt5Percent = (2000 + 1500) * 0.05;
      expect(result.cashFlowSeries[0].totalVacancyAllowance).not.toBeCloseTo(wrongIfUniformAt5Percent, 2);
    });
  });

  describe("6. ramp with high occupancy discount (low ramp occupancy)", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 12,
      units: [
        { unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
        { unitId: "Unit B", monthlyRent: 1500, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: 7, occupancyDuringRamp: 0.2 },
      ],
    };
    const result = calculateRentalWaterfall(input);

    it("month 1 effective rent = ($2K × 0.95) + ($1.5K × 0.20) = $1,900 + $300 = $2,200", () => {
      expect(result.cashFlowSeries[0].totalEffectiveRent).toBe(2200);
    });

    it("occupancyDuringRamp is applied directly (20% occupancy, not the stabilized vacancy rate)", () => {
      // If it wrongly used vacancyRatePercent instead of occupancyDuringRamp
      // during ramp, Unit B would show 1500*0.95=1425 instead of 1500*0.2=300.
      const unitBContribution = result.cashFlowSeries[0].totalEffectiveRent - 1900;
      expect(unitBContribution).toBe(300);
      expect(unitBContribution).not.toBeCloseTo(1425, 0);
    });
  });

  describe("7. long hold (24-month analysis): year 1 vs year 2 ramp progression", () => {
    // Reuses the 3-unit fixture from test 3 — a 24-month analysis with
    // staggered ramp dates is exactly what this case asks for.
    const units: RentalUnit[] = [
      { unitId: "Unit A", monthlyRent: 1500, vacancyRatePercent: 0.05, rampStartMonth: 1, rampEndMonth: null, occupancyDuringRamp: 1 },
      { unitId: "Unit B", monthlyRent: 1800, vacancyRatePercent: 0.05, rampStartMonth: 4, rampEndMonth: 10, occupancyDuringRamp: 0.5 },
      { unitId: "Unit C", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 13, rampEndMonth: 19, occupancyDuringRamp: 0.3 },
    ];
    const result = calculateRentalWaterfall({ analysisMonths: 24, units });

    it("annualSummary has exactly 2 years", () => {
      expect(result.annualSummary).toHaveLength(2);
    });

    it("rampedInUnits increases from year 1 to year 2 (2 → 3)", () => {
      expect(result.annualSummary[1].rampedInUnits).toBeGreaterThan(result.annualSummary[0].rampedInUnits);
      expect(result.annualSummary[0].rampedInUnits).toBe(2);
      expect(result.annualSummary[1].rampedInUnits).toBe(3);
    });

    it("effectiveIncome also increases year over year as units stabilize", () => {
      expect(result.annualSummary[1].effectiveIncome).toBeGreaterThan(result.annualSummary[0].effectiveIncome);
    });

    it("summary text reflects stabilization by the final year", () => {
      // Year 2 (the final year in this 24-month window) is NOT fully
      // stabilized until month 19, but month 24 (the year's last month) is
      // — so the final-year label should read "stabilized".
      expect(result.summary).toContain(`Year ${result.annualSummary.length}:`);
      expect(result.summary).toContain("(stabilized)");
    });
  });

  describe("8. edge case: unit starts at month 0", () => {
    const input: RentalWaterfallInput = {
      analysisMonths: 12,
      units: [{ unitId: "Unit A", monthlyRent: 2000, vacancyRatePercent: 0.05, rampStartMonth: 0, rampEndMonth: null, occupancyDuringRamp: 1 }],
    };
    const result = calculateRentalWaterfall(input);

    it("collects rent starting in month 1 (the first full month), same as rampStartMonth: 1 would", () => {
      expect(result.cashFlowSeries[0].totalGrossRent).toBe(2000);
      expect(result.cashFlowSeries[0].totalEffectiveRent).toBe(1900);
    });

    it("no off-by-one error: newUnitsThisMonth correctly flags the unit in month 1, not never (month 0 doesn't exist in the series)", () => {
      expect(result.cashFlowSeries[0].newUnitsThisMonth).toEqual(["Unit A"]);
      // And it must not spuriously appear again in any later month.
      const monthsFlaggingUnitA = result.cashFlowSeries.filter((m) => m.newUnitsThisMonth.includes("Unit A"));
      expect(monthsFlaggingUnitA).toHaveLength(1);
      expect(monthsFlaggingUnitA[0].month).toBe(1);
    });

    it("is counted as fully ramped (no ramp at all) from year 1", () => {
      expect(result.annualSummary[0].rampedInUnits).toBe(1);
    });
  });

  describe("rampImpact text validation", () => {
    it("describes a ramp period using the inclusive last-ramp-month convention (rampEndMonth - 1)", () => {
      const result = calculateRentalWaterfall({
        analysisMonths: 12,
        units: [{ unitId: "Unit X", monthlyRent: 1000, vacancyRatePercent: 0.05, rampStartMonth: 2, rampEndMonth: 8, occupancyDuringRamp: 0.4 }],
      });
      expect(result.unitMetrics[0].rampImpact).toBe("Ramps months 2-7 at 40% occupancy.");
    });

    it("describes no-ramp units with the immediate-occupancy message", () => {
      const result = calculateRentalWaterfall({
        analysisMonths: 12,
        units: [{ unitId: "Unit Y", monthlyRent: 1000, vacancyRatePercent: 0.05, rampStartMonth: 5, rampEndMonth: null, occupancyDuringRamp: 1 }],
      });
      expect(result.unitMetrics[0].rampImpact).toBe("No ramp — immediate occupancy from month 5.");
    });
  });
});
