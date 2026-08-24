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
 *       market (residential 1-4 unit investment property vs. commercial
 *       income property), no shared math.
 *   E83 (this file): commercial loan SIZING — computes the maximum loan
 *       three independent ways (LTV, DSCR, debt yield) and takes the
 *       smallest. Its "DSCR test" inverts the mortgage-payment formula to
 *       find the principal that keeps E9's NOI/debt-service ratio at or
 *       above a minimum; it does not touch E76's ratio at all.
 */

/** ISO-ish country selector — picks semi-annual (Canada) vs. monthly (US) rate compounding for the DSCR test's payment math, same convention E1-mortgage.ts's two payment functions already require. */
export type CommercialLoanSizingCountry = "Canada" | "US";

/** Which of the three sizing tests actually produced the smallest (binding) maximum loan. */
export type CommercialLoanBindingTest = "ltv" | "dscr" | "debtYield";

export interface CommercialLoanSizingInput {
  purchasePrice: number;
  /** Net operating income (annual) — the same NOI concept as E9's calculateNOI/calculateDSCR, already netted of vacancy and operating expenses. Feeds both the DSCR test and the debt yield test. */
  noi: number;
  /** Maximum loan-to-value the lender will underwrite, as a percent (e.g. 70 for 70%). Caps the LTV test: maxLoan = purchasePrice * (maxLtvPercent / 100). */
  maxLtvPercent: number;
  /** Minimum debt-service-coverage ratio the lender requires (NOI / annual debt service), e.g. 1.25. Caps the DSCR test: the loan whose annual debt service is exactly noi / minDscr. */
  minDscr: number;
  /**
   * Minimum debt yield the lender requires, as a percent (e.g. 8 for 8%).
   * Debt yield is NOI / loan amount — unlike DSCR and LTV, it is
   * independent of interest rate and amortization term entirely, which is
   * exactly why lenders added it as a third, rate-insensitive test: a low
   * interest rate environment can make DSCR and LTV both look safe on a
   * loan that would leave the lender dangerously undersecured on income
   * alone if rates rose or the loan needed to be refinanced. Uses NOI (not
   * gross rent) because it is meant to measure real, expense-adjusted
   * income against the loan balance, matching the DSCR test's income basis
   * so the three tests are actually comparable.
   */
  minDebtYieldPercent: number;
  /**
   * Nominal annual interest rate as a decimal (e.g. 0.065 for 6.5%), used
   * only by the DSCR test to invert the mortgage-payment formula into a
   * maximum principal. The LTV and debt yield tests are rate-independent by
   * design (see minDebtYieldPercent above) and ignore this field entirely.
   */
  annualInterestRate: number;
  /** Amortization term in years, used only by the DSCR test — the same inverted-payment math needs a number of periods (amortizationYears * 12), not just the target ratio, because a longer amortization lowers the payment for the same principal and therefore supports a larger loan at the same DSCR. */
  amortizationYears: number;
  /** Selects semi-annual (Canada) vs. monthly (US) compounding for the DSCR test's rate conversion — see E1-mortgage.ts's semiAnnualToMonthlyRate / monthlyCompoundingRate. */
  country: CommercialLoanSizingCountry;
}

export interface CommercialLoanSizingResult {
  /** purchasePrice * (maxLtvPercent / 100), unclamped. */
  ltvMaxLoan: number;
  /** The loan principal whose payment holds NOI / annual debt service at exactly minDscr, unclamped — may be negative (if minDscr is unusually high relative to NOI) or exceed purchasePrice. */
  dscrMaxLoan: number;
  /** noi / (minDebtYieldPercent / 100), unclamped. */
  debtYieldMaxLoan: number;
  /** Which of the three tests produced the smallest (binding) raw maximum loan, before clamping. */
  bindingTest: CommercialLoanBindingTest;
  /** The binding test's raw result, before clamping to [0, purchasePrice]. */
  rawSizedLoan: number;
  /** The final sized loan amount: rawSizedLoan clamped to [0, purchasePrice]. This is the loan a lender would actually underwrite. */
  sizedLoan: number;
  /** True when rawSizedLoan fell outside [0, purchasePrice] and had to be clamped — normally a signal that the inputs (e.g. minDscr, minDebtYieldPercent) are inconsistent with the deal, not an expected outcome. */
  wasClamped: boolean;
}
