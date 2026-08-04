import { MortgageInput, calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "./mortgage";
import { MortgageCountry, remainingBalance } from "./amortization";
import { calculateNOI } from "./dscr";

export interface BRRRRInput {
  /** Acquisition price. */
  purchasePrice: number;
  downPaymentPercent: number;
  /** Total renovation budget — funded entirely in cash per totalCashInvested's formula, not rolled into the original loan. */
  rehab_cost: number;
  rehab_timeline_months: number;
  /** ARV — estimated property value after rehab. */
  afterRepairValue: number;
  /** Rent after rehab is complete. */
  newMonthlyRent: number;
  /** Months of rental (seasoning) before the refinance, typically 6-12. */
  holdPeriodBeforeRefinanceMonths: number;
  /** Rate available after rehab/seasoning, for the new (refinance) loan. */
  refinanceInterestRate: number;
  refinanceAmortizationYears: number;
  country: MortgageCountry;
  /**
   * Rate on the original acquisition loan. Not in the E19 spec's input
   * list, but required to actually do what point 4's logic calls for
   * ("use amortization.ts to get remaining balance at month N") — there's
   * no way to run an amortization schedule without a rate and term.
   */
  originalInterestRate: number;
  /** Term of the original acquisition loan (see originalInterestRate). */
  originalAmortizationYears: number;
  /** LTV against ARV used to size the refinance loan. Defaults to 0.75 (75%) — the spec calls this out as "assume 75% LTV; user can adjust". */
  refinanceLTVPercent?: number;
}

export interface BRRRRResult {
  /** Down payment + rehab costs + closing costs on purchase. */
  totalCashInvested: number;
  /** Echoes the input, for reference. */
  afterRepairValue: number;
  /** afterRepairValue × refinanceLTVPercent. */
  refinanceLoanAmount: number;
  /** refinanceLoanAmount - the original loan's remaining balance at the refinance date. */
  refinanceLoanProceeds: number;
  /** refinanceLoanProceeds - closing costs on the refinance. */
  cashReturnedToInvestor: number;
  /** cashReturnedToInvestor / totalCashInvested. e.g. 1.5 = 150% of capital returned. */
  cashReturnMultiple: number;
  /** Payment on the refinanced loan. */
  newMonthlyPayment: number;
  /** Echoes newMonthlyRent, for reference. */
  monthlyRent: number;
  /** newMonthlyRent - newMonthlyPayment - estimated opex (30% of rent). */
  monthlyPositiveCashFlow: number;
  /** NOI / afterRepairValue, with NOI approximated at 70% of gross rent (30% opex assumption). */
  capRate: number;
  /** Plain-English recap: cash invested, cash returned, and resulting monthly cash flow. */
  summary: string;
}

const PURCHASE_CLOSING_COSTS_PERCENT = 0.02;
const REFINANCE_CLOSING_COSTS_PERCENT = 0.015;
const DEFAULT_REFINANCE_LTV_PERCENT = 0.75;
/** Applied to gross rent as a simple opex proxy for both capRate and monthlyPositiveCashFlow — no per-line-item expense breakdown exists at this stage of a BRRRR deal (rehab isn't even finished/leased yet). */
const OPEX_PERCENT_OF_RENT = 0.3;

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
  const annualNOI = calculateNOI({
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
