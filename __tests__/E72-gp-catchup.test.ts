/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import {
  calculateGrossedUpCatchUpTarget,
  calculateGPCatchUpForPeriod,
} from "../src/E72-gp-catchup";

describe("calculateGrossedUpCatchUpTarget", () => {
  // THE golden test for the highest-bug-risk provision in the domain (per
  // the sourced 2026 research). $80 preferred distributed, 20% catch-up
  // target -> correct grossed-up answer is $20, NOT the flat-percentage $16
  // a naive implementation would produce.
  it("computes the grossed-up catch-up target correctly ($80 preferred, 20% -> $20)", () => {
    const result = calculateGrossedUpCatchUpTarget(80, 0.2);
    expect(result).toBeCloseTo(20, 6);
  });

  it("explicitly does NOT produce the wrong flat-percentage answer ($16)", () => {
    const result = calculateGrossedUpCatchUpTarget(80, 0.2);
    const wrongFlatPercentageAnswer = 80 * 0.2; // = 16 -- the common miscalculation this engine must not ship
    expect(wrongFlatPercentageAnswer).toBeCloseTo(16, 6); // sanity-check the "wrong" value itself is what we think it is
    expect(result).not.toBeCloseTo(wrongFlatPercentageAnswer, 6);
    expect(result).toBeCloseTo(20, 6);
  });

  it("matches the closed-form identity: catchUp / (preferred + catchUp) === gpCatchUpPercent", () => {
    const preferred = 250;
    const gpCatchUpPercent = 0.25;
    const catchUp = calculateGrossedUpCatchUpTarget(preferred, gpCatchUpPercent);
    expect(catchUp / (preferred + catchUp)).toBeCloseTo(gpCatchUpPercent, 10);
  });

  it("returns 0 when gpCatchUpPercent is 0", () => {
    expect(calculateGrossedUpCatchUpTarget(1000, 0)).toBe(0);
  });

  it("throws when gpCatchUpPercent is 100% or more (the formula divides by 1 - gpCatchUpPercent)", () => {
    expect(() => calculateGrossedUpCatchUpTarget(80, 1)).toThrow(/less than 1/i);
    expect(() => calculateGrossedUpCatchUpTarget(80, 1.2)).toThrow(/less than 1/i);
  });
});

describe("calculateGPCatchUpForPeriod", () => {
  it("pays the full catch-up target in one period when cash is sufficient", () => {
    const result = calculateGPCatchUpForPeriod({
      cumulativePreferredPaidToDate: 80,
      gpCatchUpPercent: 0.2,
      cumulativeCatchUpAlreadyPaid: 0,
      availableCash: 1000,
    });

    expect(result.catchUpTargetCumulative).toBeCloseTo(20, 6);
    expect(result.catchUpOwedThisPeriod).toBeCloseTo(20, 6);
    expect(result.catchUpPaidThisPeriod).toBeCloseTo(20, 6);
  });

  it("caps the payment at available cash and carries the shortfall forward as unpaid target", () => {
    const result = calculateGPCatchUpForPeriod({
      cumulativePreferredPaidToDate: 80,
      gpCatchUpPercent: 0.2,
      cumulativeCatchUpAlreadyPaid: 0,
      availableCash: 5, // far less than the $20 owed
    });

    expect(result.catchUpOwedThisPeriod).toBeCloseTo(20, 6);
    expect(result.catchUpPaidThisPeriod).toBeCloseTo(5, 6);
  });

  it("subtracts catch-up already paid in prior periods before computing what's still owed", () => {
    const cumulativePreferredPaidToDate = 200; // grossed-up target = 200/0.8*0.2 = 50
    const result = calculateGPCatchUpForPeriod({
      cumulativePreferredPaidToDate,
      gpCatchUpPercent: 0.2,
      cumulativeCatchUpAlreadyPaid: 20, // already caught up on the first $80 of preferred
      availableCash: 1000,
    });

    expect(result.catchUpTargetCumulative).toBeCloseTo(50, 6);
    expect(result.catchUpOwedThisPeriod).toBeCloseTo(30, 6); // 50 - 20
    expect(result.catchUpPaidThisPeriod).toBeCloseTo(30, 6);
  });

  it("pays zero when GP has already caught up to the current cumulative target", () => {
    const result = calculateGPCatchUpForPeriod({
      cumulativePreferredPaidToDate: 80,
      gpCatchUpPercent: 0.2,
      cumulativeCatchUpAlreadyPaid: 20,
      availableCash: 1000,
    });

    expect(result.catchUpOwedThisPeriod).toBe(0);
    expect(result.catchUpPaidThisPeriod).toBe(0);
  });
});
