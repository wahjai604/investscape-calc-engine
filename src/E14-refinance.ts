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
import { MortgageInput, MortgageCountry, RefinanceInput, RefinanceResult } from "./types";
import { DEFAULT_REFINANCING_COSTS_PERCENT } from "./utils/constants";

function loanFor(loanAmount: number, annualInterestRate: number, amortizationYears: number): MortgageInput {
  return { purchasePrice: loanAmount, downPaymentPercent: 0, annualInterestRate, amortizationYears };
}

function monthlyPaymentFor(loan: MortgageInput, country: MortgageCountry): number {
  return country === "Canada" ? calculateMonthlyMortgagePayment(loan) : calculateMonthlyUSMortgagePayment(loan);
}

export function calculateRefinance(input: RefinanceInput): RefinanceResult {
  const {
    currentLoanAmount,
    currentInterestRate,
    currentAmortizationRemaining,
    newInterestRate,
    newAmortizationYears,
    refinancingCostsPercent = DEFAULT_REFINANCING_COSTS_PERCENT,
    holdPeriodYears,
    country,
    monthlyNOI,
  } = input;

  const currentMonthlyPayment = monthlyPaymentFor(
    loanFor(currentLoanAmount, currentInterestRate, currentAmortizationRemaining),
    country,
  );
  // Rate/term refinance: the new loan's principal is the same currentLoanAmount —
  // refinancingCosts are paid out of pocket, not rolled into the new balance.
  const newMonthlyPayment = monthlyPaymentFor(loanFor(currentLoanAmount, newInterestRate, newAmortizationYears), country);

  const monthlyPaymentChange = newMonthlyPayment - currentMonthlyPayment;
  const monthlySavings = -monthlyPaymentChange; // positive = payment went down

  const refinancingCosts = currentLoanAmount * refinancingCostsPercent;

  const breakEvenMonth = monthlyPaymentChange >= 0 ? Infinity : refinancingCosts / Math.abs(monthlyPaymentChange);
  const breakEvenYears = breakEvenMonth / 12;

  const holdPeriodMonths = holdPeriodYears * 12;
  const cashFlowImprovement = monthlySavings * 12 * holdPeriodYears;
  const totalSavingsOverHold = cashFlowImprovement - refinancingCosts;

  const shouldRefinance = breakEvenMonth < holdPeriodMonths && monthlyPaymentChange < 0;

  const summary = buildSummary({
    monthlyPaymentChange,
    monthlySavings,
    breakEvenMonth,
    holdPeriodYears,
    shouldRefinance,
    currentMonthlyPayment,
    newMonthlyPayment,
    monthlyNOI,
  });

  return {
    currentMonthlyPayment,
    newMonthlyPayment,
    monthlyPaymentChange,
    refinancingCosts,
    breakEvenMonth,
    breakEvenYears,
    totalSavingsOverHold,
    cashFlowImprovement,
    shouldRefinance,
    summary,
  };
}

function buildSummary(args: {
  monthlyPaymentChange: number;
  monthlySavings: number;
  breakEvenMonth: number;
  holdPeriodYears: number;
  shouldRefinance: boolean;
  currentMonthlyPayment: number;
  newMonthlyPayment: number;
  monthlyNOI: number;
}): string {
  const { monthlyPaymentChange, monthlySavings, breakEvenMonth, holdPeriodYears, shouldRefinance, currentMonthlyPayment, newMonthlyPayment, monthlyNOI } =
    args;

  const cashFlowNote = `Monthly cash flow (NOI − payment) goes from $${(monthlyNOI - currentMonthlyPayment).toFixed(2)} to $${(monthlyNOI - newMonthlyPayment).toFixed(2)}.`;

  if (monthlyPaymentChange >= 0) {
    return `Not recommended — the new rate/term does not lower your monthly payment (change: +$${monthlyPaymentChange.toFixed(2)}/month). ${cashFlowNote}`;
  }

  if (shouldRefinance) {
    return `Refinance saves $${monthlySavings.toFixed(2)}/month. Break-even in ${breakEvenMonth.toFixed(1)} months. Recommended. ${cashFlowNote}`;
  }

  return `Not recommended — break-even in ${breakEvenMonth.toFixed(1)} months exceeds your ${holdPeriodYears}-year hold period. ${cashFlowNote}`;
}
