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

/**
 * DO NOT CONFUSE THIS ENGINE'S "DSCR test" WITH E76-dscr-loan-sizing.ts.
 * Three different things share the letters "DSCR" or the word "sizing"
 * across this codebase:
 *
 *   E9  (calculateDSCR): net operating income / annual debt service — the
 *       commercial-lending ratio. E83's DSCR test CALLS INTO this
 *       convention (NOI ÷ minDscr is step one of sizing the DSCR-test
 *       loan), it does not reimplement or replace it.
 *   E76 (LoanConventionDSCR): gross monthly rent / monthly PITIA — the
 *       DSCR-LOAN-PROGRAM underwriting ratio non-QM residential investor
 *       lenders use to qualify a borrower. Completely unrelated to this
 *       engine: different numerator, different denominator, different
 *       market, no shared math. See E76-dscr-loan-sizing.ts's own top-of-
 *       file warning for the full explanation.
 *   E83 (this file): commercial loan SIZING — computes the maximum loan
 *       three independent ways (LTV, DSCR, debt yield) and takes the
 *       smallest. Its "DSCR test" inverts the mortgage-payment formula to
 *       find the principal that keeps E9's NOI/debt-service ratio at or
 *       above a minimum; it does not touch E76's ratio at all.
 *
 * Commercial lenders don't size a loan from a down-payment percentage the
 * way residential lending does. They compute the maximum loan three
 * independent ways and take the SMALLEST — whichever one binds is itself
 * valuable information (e.g. in a low-cap-rate market, debt yield usually
 * binds even when LTV and DSCR both look fine).
 */

import { presentValueFromPayment, semiAnnualToMonthlyRate, monthlyCompoundingRate } from "./E1-mortgage";
import { CommercialLoanSizingInput, CommercialLoanSizingResult, CommercialLoanBindingTest } from "./types";

function calculateLtvMaxLoan(purchasePrice: number, maxLtvPercent: number): number {
  return purchasePrice * (maxLtvPercent / 100);
}

function calculateDebtYieldMaxLoan(noi: number, minDebtYieldPercent: number): number {
  return noi / (minDebtYieldPercent / 100);
}

/**
 * Inverts the mortgage-payment formula: given the maximum annual debt
 * service NOI can support at minDscr — algebraically, calculateDSCR's
 * netOperatingIncome / annualDebtService = minDscr solved for
 * annualDebtService — solve for the principal that produces a payment
 * equal to that debt service. Reuses E1-mortgage.ts's PMT-inverse
 * (presentValueFromPayment) and its Canada/US rate-conversion functions
 * rather than reimplementing the amortization math here.
 */
function calculateDscrMaxLoan(input: CommercialLoanSizingInput): number {
  const { noi, minDscr, annualInterestRate, amortizationYears, country } = input;

  const maxAnnualDebtService = noi / minDscr;
  const maxMonthlyPayment = maxAnnualDebtService / 12;
  const monthlyRate =
    country === "Canada" ? semiAnnualToMonthlyRate(annualInterestRate) : monthlyCompoundingRate(annualInterestRate);
  const numberOfPayments = amortizationYears * 12;

  return presentValueFromPayment(monthlyRate, numberOfPayments, maxMonthlyPayment);
}

export function calculateCommercialLoanSizing(input: CommercialLoanSizingInput): CommercialLoanSizingResult {
  const { purchasePrice, noi, maxLtvPercent, minDebtYieldPercent } = input;

  const ltvMaxLoan = calculateLtvMaxLoan(purchasePrice, maxLtvPercent);
  const dscrMaxLoan = calculateDscrMaxLoan(input);
  const debtYieldMaxLoan = calculateDebtYieldMaxLoan(noi, minDebtYieldPercent);

  const tests: [CommercialLoanBindingTest, number][] = [
    ["ltv", ltvMaxLoan],
    ["dscr", dscrMaxLoan],
    ["debtYield", debtYieldMaxLoan],
  ];

  const [bindingTest, rawSizedLoan] = tests.reduce((min, test) => (test[1] < min[1] ? test : min));

  const sizedLoan = Math.min(Math.max(rawSizedLoan, 0), purchasePrice);
  const wasClamped = sizedLoan !== rawSizedLoan;

  return {
    ltvMaxLoan,
    dscrMaxLoan,
    debtYieldMaxLoan,
    bindingTest,
    rawSizedLoan,
    sizedLoan,
    wasClamped,
  };
}
