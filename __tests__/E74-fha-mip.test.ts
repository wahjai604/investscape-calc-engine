/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateFHAMIP } from "../src/E74-fha-mip";

describe("calculateFHAMIP", () => {
  it("charges the upfront MIP at 1.75% of the loan amount regardless of term/LTV/conforming status", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.035,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.upfrontMIPRate).toBe(0.0175);
    expect(result.upfrontMIPAmount).toBeCloseTo(5250, 2);
  });

  it("30yr term, under 5% down (high LTV): 0.55% annual MIP", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.035,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.0055, 6);
    expect(result.annualMIPAmount).toBeCloseTo(1650, 2);
    expect(result.monthlyMIPAmount).toBeCloseTo(137.5, 2);
  });

  it("30yr term, at/above 5% down (low LTV): 0.50% annual MIP", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.05,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.005, 6);
  });

  it("15yr term, under 10% down (high LTV): 0.40% annual MIP", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.05,
      amortizationYears: 15,
      isHighCostArea: false,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.004, 6);
  });

  it("15yr term, at/above 10% down (low LTV): 0.15% annual MIP — the sourced floor", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.1,
      amortizationYears: 15,
      isHighCostArea: false,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.0015, 6);
  });

  it("30yr high-LTV loan above the conforming limit adds the surcharge, reaching the sourced 0.75% ceiling", () => {
    const result = calculateFHAMIP({
      loanAmount: 900000, // exceeds US_CONFORMING_LOAN_LIMIT_STANDARD
      downPaymentPercent: 0.035,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.0075, 6);
  });

  it("uses the high-cost-area conforming limit, so a loan that would be above-limit standard isn't surcharged there", () => {
    const result = calculateFHAMIP({
      loanAmount: 900000, // above standard limit, but under the high-cost limit
      downPaymentPercent: 0.035,
      amortizationYears: 30,
      isHighCostArea: true,
    });
    expect(result.annualMIPRate).toBeCloseTo(0.0055, 6); // no surcharge
  });

  it("is eligible for automatic 11-year removal at exactly 10% down (the post-2013 rule boundary)", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.1,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.automaticRemovalEligible).toBe(true);
    expect(result.automaticRemovalAfterYears).toBe(11);
    expect(result.isLifeOfLoan).toBe(false);
  });

  it("is life-of-loan MIP just under the 10% down threshold", () => {
    const result = calculateFHAMIP({
      loanAmount: 300000,
      downPaymentPercent: 0.099,
      amortizationYears: 30,
      isHighCostArea: false,
    });
    expect(result.automaticRemovalEligible).toBe(false);
    expect(result.automaticRemovalAfterYears).toBeNull();
    expect(result.isLifeOfLoan).toBe(true);
  });
});
