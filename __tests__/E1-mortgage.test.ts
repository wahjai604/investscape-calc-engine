/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "../src/E1-mortgage";

describe("calculateMonthlyMortgagePayment", () => {
  // Golden value validated against the FCAC (Government of Canada) mortgage
  // calculator, which uses Canadian semi-annual compounding. The Template v2
  // spreadsheet's $2,217.06 used a US-style rate/12 formula and is not a
  // valid reference for this case.
  it("matches the FCAC-validated figure for the $550,000 / 27.5% down / 4.54% / 25yr case", () => {
    const payment = calculateMonthlyMortgagePayment({
      purchasePrice: 550000,
      downPaymentPercent: 0.275,
      annualInterestRate: 0.0454,
      amortizationYears: 25,
    });

    expect(payment).toBeCloseTo(2215.85, 2);
  });
});

describe("calculateMonthlyUSMortgagePayment", () => {
  // Golden value is the classic textbook example (e.g. Ross, Corporate
  // Finance): a $100,000 loan at 6% annual interest over 30 years compounded
  // monthly amortizes to $599.55/month. Widely published and independently
  // verifiable against any standard US mortgage calculator.
  it("matches the standard reference figure for a $100,000 / 0% down / 6% / 30yr loan", () => {
    const payment = calculateMonthlyUSMortgagePayment({
      purchasePrice: 100000,
      downPaymentPercent: 0,
      annualInterestRate: 0.06,
      amortizationYears: 30,
    });

    expect(payment).toBeCloseTo(599.55, 2);
  });
});
