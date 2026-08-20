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

import { calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "./E1-mortgage";
import { remainingBalance } from "./E2-amortization";
import { calculateNOI } from "./E9-dscr";
import { MortgageInput, MortgageCountry, BRRRRInput, BRRRRResult } from "./types";
import {
  PURCHASE_CLOSING_COSTS_PERCENT,
  REFINANCE_CLOSING_COSTS_PERCENT,
  DEFAULT_REFINANCE_LTV_PERCENT,
  OPEX_PERCENT_OF_RENT,
} from "./utils/constants";

function monthlyPaymentFor(loan: MortgageInput, country: MortgageCountry): number {
  return country === "Canada" ? calculateMonthlyMortgagePayment(loan) : calculateMonthlyUSMortgagePayment(loan);
}

export function calculateBRRRR(input: BRRRRInput): BRRRRResult {
  const {
    purchasePrice,
    downPaymentPercent,
    rehab_cost,
    rehab_timeline_months,
    afterRepairValue,
    newMonthlyRent,
    holdPeriodBeforeRefinanceMonths,
    refinanceInterestRate,
    refinanceAmortizationYears,
    country,
    originalInterestRate,
    originalAmortizationYears,
    refinanceLTVPercent = DEFAULT_REFINANCE_LTV_PERCENT,
  } = input;

  const purchaseClosingCosts = purchasePrice * PURCHASE_CLOSING_COSTS_PERCENT;
  const totalCashInvested = purchasePrice * downPaymentPercent + rehab_cost + purchaseClosingCosts;

  const originalLoan: MortgageInput = {
    purchasePrice,
    downPaymentPercent,
    annualInterestRate: originalInterestRate,
    amortizationYears: originalAmortizationYears,
  };
  const monthsUntilRefinance = rehab_timeline_months + holdPeriodBeforeRefinanceMonths;
  const originalRemainingBalance = remainingBalance(originalLoan, country, monthsUntilRefinance);

  const refinanceLoanAmount = afterRepairValue * refinanceLTVPercent;
  const refinanceLoanProceeds = refinanceLoanAmount - originalRemainingBalance;

  const refinanceClosingCosts = refinanceLoanAmount * REFINANCE_CLOSING_COSTS_PERCENT;
  const cashReturnedToInvestor = refinanceLoanProceeds - refinanceClosingCosts;

  const cashReturnMultiple = cashReturnedToInvestor / totalCashInvested;

  // Same purchasePrice-as-principal, 0%-down trick used elsewhere in this
  // codebase (see amortization.test.ts) — refinanceLoanAmount is a raw
  // principal, not a price with its own down payment.
  const refinanceLoan: MortgageInput = {
    purchasePrice: refinanceLoanAmount,
    downPaymentPercent: 0,
    annualInterestRate: refinanceInterestRate,
    amortizationYears: refinanceAmortizationYears,
  };
  const newMonthlyPayment = monthlyPaymentFor(refinanceLoan, country);

  // vacancyRatePercent: 0 — the 30% "opex" figure here already stands in for
  // the whole simplified expense estimate the spec calls for; a separate
  // vacancy deduction isn't part of that estimate.
  const { netOperatingIncome: annualNOI } = calculateNOI({
    grossAnnualRent: newMonthlyRent * 12,
    vacancyRatePercent: 0,
    annualOperatingExpenses: newMonthlyRent * 12 * OPEX_PERCENT_OF_RENT,
  });
  const monthlyPositiveCashFlow = annualNOI / 12 - newMonthlyPayment;
  const capRate = annualNOI / afterRepairValue;

  const summary =
    `Invested $${totalCashInvested.toFixed(2)}, got back $${cashReturnedToInvestor.toFixed(2)} ` +
    `(${cashReturnMultiple.toFixed(2)}x capital returned), keeping $${monthlyPositiveCashFlow.toFixed(2)}/month.`;

  return {
    totalCashInvested,
    afterRepairValue,
    refinanceLoanAmount,
    refinanceLoanProceeds,
    cashReturnedToInvestor,
    cashReturnMultiple,
    newMonthlyPayment,
    monthlyRent: newMonthlyRent,
    monthlyPositiveCashFlow,
    capRate,
    summary,
  };
}
