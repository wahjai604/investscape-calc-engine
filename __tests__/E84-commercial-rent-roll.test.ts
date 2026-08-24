/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import {
  calculateWALT,
  calculateRolloverSchedule,
  calculateOccupancy,
  calculateBaseRentAndRecoveries,
  calculateExpiryConcentration,
} from "../src/E84-commercial-rent-roll";
import { CommercialRentRollSuite, RolloverYear } from "../src/types";
import { COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT } from "../src/utils/constants";

function makeSuite(overrides: Partial<CommercialRentRollSuite>): CommercialRentRollSuite {
  return {
    suiteId: "S0",
    tenantName: "Tenant",
    areaSf: 1000,
    leaseStart: "2020-01-01",
    leaseEnd: "2030-01-01",
    baseRentPsfPerYear: 20,
    escalationType: "none",
    escalationRate: 0,
    leaseStructure: "FSG",
    recoveryPercent: 0,
    renewalProbabilityPercent: 50,
    tiPsf: 0,
    lcPercent: 0,
    isOccupied: true,
    ...overrides,
  };
}

describe("calculateWALT", () => {
  /**
   * Hand-verified worked example.
   *
   * asOfDate = 2026-01-01. remainingYears_i = (leaseEnd_i - asOfDate) in
   * days / 365.25 (this engine's yearsBetween convention), floored at 0:
   *   A: leaseEnd 2027-01-01 → 365 days / 365.25  = 0.999315537303217
   *   B: leaseEnd 2029-01-01 → 1096 days / 365.25 = 3.000684462696783
   *   C: leaseEnd 2031-01-01 → 1825 days / 365.25 = 4.999315537303217
   *
   * weight_i = baseRentPsfPerYear_i * areaSf_i:
   *   A: 20 * 1000 = 20,000
   *   B: 30 * 2000 = 60,000
   *   C: 25 * 1500 = 37,500
   *   sum weights = 117,500
   *
   * WALT = (0.999315537303217*20000 + 3.000684462696783*60000 + 4.999315537303217*37500) / 117500
   *      = 3.297886903461634
   */
  it("computes a rent-weighted WALT matching the hand-derived worked example", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "A", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2027-01-01" }),
      makeSuite({ suiteId: "B", areaSf: 2000, baseRentPsfPerYear: 30, leaseEnd: "2029-01-01" }),
      makeSuite({ suiteId: "C", areaSf: 1500, baseRentPsfPerYear: 25, leaseEnd: "2031-01-01" }),
    ];

    const walt = calculateWALT(suites, new Date("2026-01-01"));
    expect(walt).toBeCloseTo(3.297886903461634, 6);
  });

  it("excludes vacant suites from the weighting (they have no lease to weight)", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "A", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2027-01-01", isOccupied: true }),
      makeSuite({ suiteId: "VACANT", areaSf: 5000, baseRentPsfPerYear: 0, leaseEnd: "2020-01-01", isOccupied: false }),
    ];

    const walt = calculateWALT(suites, new Date("2026-01-01"));
    const waltOccupiedOnly = calculateWALT([suites[0]], new Date("2026-01-01"));
    expect(walt).toBeCloseTo(waltOccupiedOnly, 10);
  });

  it("returns 0 (not NaN/Infinity) when there are no occupied suites", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "VACANT1", isOccupied: false }),
      makeSuite({ suiteId: "VACANT2", isOccupied: false }),
    ];

    expect(calculateWALT(suites, new Date("2026-01-01"))).toBe(0);
    expect(calculateWALT([], new Date("2026-01-01"))).toBe(0);
  });
});

describe("calculateRolloverSchedule", () => {
  it("buckets a suite expiring exactly at a year boundary into the correct calendar year", () => {
    const asOfDate = new Date("2026-01-01");
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "S1", areaSf: 500, baseRentPsfPerYear: 10, leaseEnd: "2026-12-31" }),
      makeSuite({ suiteId: "S2", areaSf: 500, baseRentPsfPerYear: 10, leaseEnd: "2027-01-01" }),
    ];

    const schedule = calculateRolloverSchedule(suites, asOfDate, 2);

    expect(schedule).toHaveLength(2);
    expect(schedule[0].year).toBe(2026);
    expect(schedule[0].expiringSuiteIds).toEqual(["S1"]);
    expect(schedule[0].expiringRentPercent).toBeCloseTo(50, 6);
    expect(schedule[0].expiringAreaPercent).toBeCloseTo(50, 6);

    expect(schedule[1].year).toBe(2027);
    expect(schedule[1].expiringSuiteIds).toEqual(["S2"]);
    expect(schedule[1].expiringRentPercent).toBeCloseTo(50, 6);
    expect(schedule[1].expiringAreaPercent).toBeCloseTo(50, 6);
  });

  /**
   * Regression guard for a 60%+ single-year concentration scenario:
   * A + B (both $20,000/yr) expire in 2028, C ($20,000/yr) expires in 2030.
   * Total rent = $60,000. 2028's share = 40,000 / 60,000 = 66.67%, well
   * past the 30% concentration threshold — exactly the kind of rollover
   * risk WALT alone would hide.
   */
  it("surfaces a 60%+ single-year expiry concentration", () => {
    const asOfDate = new Date("2026-01-01");
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "A", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2028-06-01" }),
      makeSuite({ suiteId: "B", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2028-06-01" }),
      makeSuite({ suiteId: "C", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2030-06-01" }),
    ];

    const schedule = calculateRolloverSchedule(suites, asOfDate, 5);
    const year2028 = schedule.find((y) => y.year === 2028)!;

    expect(year2028.expiringSuiteIds.sort()).toEqual(["A", "B"]);
    expect(year2028.expiringRentPercent).toBeCloseTo((40000 / 60000) * 100, 6);
    expect(year2028.expiringRentPercent).toBeGreaterThanOrEqual(60);
  });

  it("returns yearsAhead zeroed entries (not NaN) for a fully-empty suites array", () => {
    const schedule = calculateRolloverSchedule([], new Date("2026-01-01"), 3);

    expect(schedule).toHaveLength(3);
    expect(schedule.map((y) => y.year)).toEqual([2026, 2027, 2028]);
    for (const year of schedule) {
      expect(year.expiringRentPercent).toBe(0);
      expect(year.expiringAreaPercent).toBe(0);
      expect(year.expiringSuiteIds).toEqual([]);
    }
  });

  it("excludes vacant suites from both numerator and denominator contribution to rent, but keeps them in the area denominator", () => {
    const asOfDate = new Date("2026-01-01");
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "OCC", areaSf: 1000, baseRentPsfPerYear: 20, leaseEnd: "2026-06-01", isOccupied: true }),
      makeSuite({ suiteId: "VAC", areaSf: 1000, baseRentPsfPerYear: 0, leaseEnd: "2020-01-01", isOccupied: false }),
    ];

    const schedule = calculateRolloverSchedule(suites, asOfDate, 1);
    expect(schedule[0].expiringSuiteIds).toEqual(["OCC"]);
    expect(schedule[0].expiringRentPercent).toBeCloseTo(100, 6);
    expect(schedule[0].expiringAreaPercent).toBeCloseTo(50, 6);
  });
});

describe("calculateOccupancy", () => {
  it("computes occupancyByArea from mixed occupied/vacant suites", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "A", areaSf: 1000, isOccupied: true }),
      makeSuite({ suiteId: "B", areaSf: 2000, isOccupied: true }),
      makeSuite({ suiteId: "C", areaSf: 1500, isOccupied: false }),
    ];

    const result = calculateOccupancy(suites);
    expect(result.occupancyByArea).toBeCloseTo(3000 / 4500, 10);
  });

  it("does not include an occupancyByRent field at all", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "A", areaSf: 1000, isOccupied: true }),
      makeSuite({ suiteId: "B", areaSf: 1000, isOccupied: false }),
    ];

    const result = calculateOccupancy(suites);
    expect(Object.keys(result)).toEqual(["occupancyByArea"]);
    expect((result as unknown as Record<string, unknown>).occupancyByRent).toBeUndefined();
  });
});

describe("calculateBaseRentAndRecoveries", () => {
  it("splits base rent and recoveries correctly between an FSG (0% recovery) and NNN (100% recovery) suite", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({
        suiteId: "FSG",
        areaSf: 1000,
        baseRentPsfPerYear: 20,
        leaseStructure: "FSG",
        recoveryPercent: 0,
      }),
      makeSuite({
        suiteId: "NNN",
        areaSf: 1000,
        baseRentPsfPerYear: 25,
        leaseStructure: "NNN",
        recoveryPercent: 100,
      }),
    ];

    const totalBuildingAnnualOpex = 100_000;
    const result = calculateBaseRentAndRecoveries(suites, totalBuildingAnnualOpex);

    // allocatedOpex is pro-rata by area: each suite is 1000/2000 = 50% of area → $50,000 allocated each.
    expect(result.baseRentTotal).toBeCloseTo(20_000 + 25_000, 6);
    expect(result.recoveriesTotal).toBeCloseTo(0 + 50_000, 6);
    expect(result.grossIncome).toBeCloseTo(result.baseRentTotal + result.recoveriesTotal, 6);
  });

  it("excludes vacant suites from baseRentTotal and recoveriesTotal but still allocates them opex share (unclaimed)", () => {
    const suites: CommercialRentRollSuite[] = [
      makeSuite({ suiteId: "OCC", areaSf: 1000, baseRentPsfPerYear: 20, recoveryPercent: 100, isOccupied: true }),
      makeSuite({ suiteId: "VAC", areaSf: 1000, baseRentPsfPerYear: 0, recoveryPercent: 100, isOccupied: false }),
    ];

    const result = calculateBaseRentAndRecoveries(suites, 100_000);
    expect(result.baseRentTotal).toBeCloseTo(20_000, 6);
    // Only the occupied suite's 50% allocated opex share ($50,000) is actually recovered.
    expect(result.recoveriesTotal).toBeCloseTo(50_000, 6);
  });
});

describe("calculateExpiryConcentration", () => {
  it("flags isConcentrated true when the worst year is at/above the threshold", () => {
    const schedule: RolloverYear[] = [
      { year: 2026, expiringRentPercent: COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT + 15, expiringAreaPercent: 40, expiringSuiteIds: ["A"] },
      { year: 2027, expiringRentPercent: 20, expiringAreaPercent: 15, expiringSuiteIds: ["B"] },
    ];

    const result = calculateExpiryConcentration(schedule);
    expect(result.maxSingleYearExpiryYear).toBe(2026);
    expect(result.maxSingleYearExpiryPercent).toBeCloseTo(COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT + 15, 6);
    expect(result.isConcentrated).toBe(true);
  });

  it("flags isConcentrated false when every year is below the threshold", () => {
    const schedule: RolloverYear[] = [
      { year: 2026, expiringRentPercent: 20, expiringAreaPercent: 18, expiringSuiteIds: ["A"] },
      { year: 2027, expiringRentPercent: 25, expiringAreaPercent: 22, expiringSuiteIds: ["B"] },
      { year: 2028, expiringRentPercent: 15, expiringAreaPercent: 10, expiringSuiteIds: ["C"] },
    ];

    const result = calculateExpiryConcentration(schedule);
    expect(result.maxSingleYearExpiryYear).toBe(2027);
    expect(result.maxSingleYearExpiryPercent).toBeCloseTo(25, 6);
    expect(result.isConcentrated).toBe(false);
  });
});
