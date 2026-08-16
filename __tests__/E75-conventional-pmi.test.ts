/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateConventionalPMI, calculatePMIRate } from "../src/E75-conventional-pmi";

describe("calculateConventionalPMI — 80% LTV boundary", () => {
  it("returns a real zero, not an omitted field, at exactly 80% LTV (20% down)", () => {
    const result = calculateConventionalPMI({ loanAmount: 300000, downPaymentPercent: 0.2, creditScore: 700 });
    expect(result.loanToValuePercent).toBeCloseTo(0.8, 6);
    expect(result.pmiRequired).toBe(false);
    expect(result.annualPMIRate).toBe(0);
    expect(result.annualPMIAmount).toBe(0);
    expect(result.monthlyPMIAmount).toBe(0);
  });

  it("requires PMI just above 80% LTV (19% down)", () => {
    const result = calculateConventionalPMI({ loanAmount: 300000, downPaymentPercent: 0.19, creditScore: 700 });
    expect(result.loanToValuePercent).toBeCloseTo(0.81, 6);
    expect(result.pmiRequired).toBe(true);
    expect(result.annualPMIRate).toBeGreaterThan(0);
    expect(result.annualPMIAmount).toBeGreaterThan(0);
  });

  it("does not require PMI further below the 80% threshold (30% down)", () => {
    const result = calculateConventionalPMI({ loanAmount: 300000, downPaymentPercent: 0.3, creditScore: 700 });
    expect(result.pmiRequired).toBe(false);
    expect(result.annualPMIRate).toBe(0);
  });

  it("reports 80% as the cancellable-at LTV regardless of whether PMI currently applies", () => {
    const result = calculateConventionalPMI({ loanAmount: 300000, downPaymentPercent: 0.1, creditScore: 700 });
    expect(result.cancellableAtLTV).toBe(0.8);
  });
});

describe("calculatePMIRate — driven by LTV and credit score, clamped to the sourced 0.3%-1.5% range", () => {
  it("hits the 0.3% floor for the best LTV/credit combination", () => {
    expect(calculatePMIRate(0.82, 770)).toBeCloseTo(0.003, 6);
  });

  it("hits the 1.5% ceiling for the worst LTV/credit combination", () => {
    expect(calculatePMIRate(0.97, 650)).toBeCloseTo(0.015, 6);
  });

  it("a lower credit score produces a higher rate at the same LTV", () => {
    const goodCredit = calculatePMIRate(0.9, 760);
    const poorCredit = calculatePMIRate(0.9, 650);
    expect(poorCredit).toBeGreaterThan(goodCredit);
  });

  it("a higher LTV produces a higher rate at the same credit score", () => {
    const lowerLTV = calculatePMIRate(0.85, 700);
    const higherLTV = calculatePMIRate(0.95, 700);
    expect(higherLTV).toBeGreaterThan(lowerLTV);
  });

  it("falls back to the steepest tier above the highest named LTV band (e.g. 99% LTV, 1% down)", () => {
    const result = calculatePMIRate(0.99, 700);
    expect(result).toBeCloseTo(0.012, 6); // same base rate as the 97% tier, clamped within range
  });
});
