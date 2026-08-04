import { MortgageInput, calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "./mortgage";
import { MortgageCountry } from "./amortization";

export interface RefinanceInput {
  /** Loan balance today. */
  currentLoanAmount: number;
  currentInterestRate: number;
  /** Years left on the current loan. */
  currentAmortizationRemaining: number;
  newInterestRate: number;
  newAmortizationYears: number;
  /** Defaults to 0.015 (1.5% of currentLoanAmount) — appraisal, legal, discharge/registration fees, etc. */
  refinancingCostsPercent?: number;
  /** How long they plan to keep the property after refinancing. */
  holdPeriodYears: number;
  country: MortgageCountry;
  /** Net operating income per month — used only to contextualize the cash flow impact in summary, not in any of the core payment/break-even math. */
  monthlyNOI: number;
}

export interface RefinanceResult {
  currentMonthlyPayment: number;
  newMonthlyPayment: number;
  /** newMonthlyPayment - currentMonthlyPayment. Negative = the payment goes down (savings). */
  monthlyPaymentChange: number;
  refinancingCosts: number;
  /** Month at which cumulative payment savings recoup refinancingCosts. Infinity if the payment doesn't go down. */
  breakEvenMonth: number;
  breakEvenYears: number;
  /**
   * Net payment savings over the hold period, after recouping
   * refinancingCosts: (monthly savings × 12 × holdPeriodYears) −
   * refinancingCosts. Despite the name, this is a payment-based figure
   * (principal + interest), not a true interest-only comparison of two
   * amortization schedules — computing that would require running both
   * schedules through amortization.ts, which this module doesn't do.
   * Negative when the new payment is higher (a net cost, not a saving).
   */
  totalSavingsOverHold: number;
  /** Gross payment savings over the hold period, before subtracting refinancingCosts: monthly savings × 12 × holdPeriodYears. Negative when the new payment is higher. */
  cashFlowImprovement: number;
  /** true only when the payment actually goes down AND break-even happens strictly before the end of the hold period. */
  shouldRefinance: boolean;
  /** Plain-English recommendation. */
  summary: string;
}

const DEFAULT_REFINANCING_COSTS_PERCENT = 0.015;

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
