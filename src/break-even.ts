import { MortgageInput, calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "./mortgage";
import { MortgageCountry, amortizationSchedule } from "./amortization";

export interface BreakEvenInput {
  purchasePrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  amortizationYears: number;
  country: MortgageCountry;
  monthlyRent: number;
  /** Months of the year the unit sits vacant, e.g. 1 for a typical one-month annual turnover allowance. */
  vacancyMonths: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  maintenanceAnnual: number;
  /** Decimal fraction of collected (post-vacancy) rent paid out as a property management fee, e.g. 0.08 for 8%. */
  propertyMgmtFeePercent: number;
  strataFeeAnnual: number;
}

export interface BreakEvenResultDownPayment {
  /** Down payment percent (decimal) at which projected annual cash flow equals $0. */
  down_pct_for_zero_cf: number;
  /** Dollar amount of down payment corresponding to down_pct_for_zero_cf. */
  down_amt_needed: number;
  /** Annual cash flow at the input's actual (current) down payment percent. */
  current_annual_cf: number;
  /**
   * Month (1-12) within the first year at which cumulative cash flow first
   * reaches $0, under the assumption that vacancyMonths occur consecutively
   * at the start of the year followed by full-year occupancy thereafter.
   * 0 when there is no vacancy to recover from (vacancyMonths <= 0). null
   * when cumulative cash flow never reaches $0 within the 12-month year at
   * the current down payment percent.
   */
  months_to_zero_cf: number | null;
  /** Down payment percent (decimal) actually supplied on the input, echoed back for convenience. */
  down_pct_current: number;
}

export interface BreakEvenResultMonthlyPayment {
  /** Maximum monthly debt service the property's NOI can support while annual cash flow stays at $0. */
  monthly_payment_for_zero_cf: number;
  /** Actual monthly mortgage payment at the input's current down payment percent and rate. */
  current_monthly_payment: number;
  /** current_monthly_payment - monthly_payment_for_zero_cf. Positive means the property is cash-flow negative. */
  monthly_shortfall: number;
  /** monthly_shortfall annualized (x12). Equal in magnitude, opposite in sign, to current annual cash flow. */
  annual_shortfall: number;
  /** Down payment percent (decimal) actually supplied on the input, echoed back for convenience. */
  down_pct_current: number;
}

export type BreakEvenMode = "down_payment" | "monthly_payment";
export type BreakEvenResult = BreakEvenResultDownPayment | BreakEvenResultMonthlyPayment;

const MIN_DOWN_PAYMENT_PERCENT = 0.05;
const MAX_DOWN_PAYMENT_PERCENT = 0.95;
/** Bisection stops once the candidate annual cash flow is within $1 of zero. */
const CASH_FLOW_TOLERANCE = 1;
const MAX_BISECTION_ITERATIONS = 100;

function loanFor(input: BreakEvenInput, downPaymentPercent: number): MortgageInput {
  return {
    purchasePrice: input.purchasePrice,
    downPaymentPercent,
    annualInterestRate: input.annualInterestRate,
    amortizationYears: input.amortizationYears,
  };
}

function monthlyPaymentFor(loan: MortgageInput, country: MortgageCountry): number {
  return country === "Canada" ? calculateMonthlyMortgagePayment(loan) : calculateMonthlyUSMortgagePayment(loan);
}

/**
 * Annual net operating income: collected rent (gross rent less vacancy loss)
 * minus operating expenses, including a management fee levied on collected
 * rent rather than gross rent. Independent of down payment percent.
 */
function annualNOI(input: BreakEvenInput): number {
  const grossAnnualRent = input.monthlyRent * 12;
  const vacancyLoss = input.monthlyRent * input.vacancyMonths;
  const collectedRent = grossAnnualRent - vacancyLoss;
  const propertyMgmtFee = collectedRent * input.propertyMgmtFeePercent;

  const operatingExpenses =
    input.propertyTaxAnnual + input.insuranceAnnual + input.maintenanceAnnual + input.strataFeeAnnual + propertyMgmtFee;

  return collectedRent - operatingExpenses;
}

/**
 * Full first-year P&I debt service at the given down payment percent, taken
 * from amortizationSchedule() rather than monthly-payment-times-twelve so
 * this stays consistent with how cashflow.ts sources real debt service.
 */
function annualDebtService(input: BreakEvenInput, downPaymentPercent: number): number {
  const loan = loanFor(input, downPaymentPercent);
  const schedule = amortizationSchedule(loan, input.country, 12);
  return schedule.reduce((sum, row) => sum + row.payment, 0);
}

/**
 * Annual cash flow (NOI - debt service) for a break-even input. Pass
 * downPctOverride to evaluate cash flow at a hypothetical down payment
 * percent without mutating the input, e.g. during Mode A's bisection search.
 */
export function calculateAnnualCashFlow(input: BreakEvenInput, downPctOverride?: number): number {
  const downPaymentPercent = downPctOverride ?? input.downPaymentPercent;
  return annualNOI(input) - annualDebtService(input, downPaymentPercent);
}

/**
 * Bisection search over [5%, 95%] down for the down payment percent at which
 * annual cash flow crosses $0. Annual cash flow rises monotonically with
 * down payment percent (more equity means less principal financed, so a
 * smaller fixed payment), which is what makes bisection valid here. If cash
 * flow doesn't cross zero within the search range, the closest boundary
 * (5% or 95%) is returned instead of extrapolating beyond it.
 */
function solveDownPaymentForZeroCashFlow(input: BreakEvenInput): number {
  let lowPercent = MIN_DOWN_PAYMENT_PERCENT;
  let highPercent = MAX_DOWN_PAYMENT_PERCENT;

  const cashFlowAtLow = calculateAnnualCashFlow(input, lowPercent);
  if (cashFlowAtLow >= 0) return lowPercent;

  const cashFlowAtHigh = calculateAnnualCashFlow(input, highPercent);
  if (cashFlowAtHigh <= 0) return highPercent;

  let midPercent = (lowPercent + highPercent) / 2;
  for (let iteration = 0; iteration < MAX_BISECTION_ITERATIONS; iteration++) {
    midPercent = (lowPercent + highPercent) / 2;
    const cashFlowAtMid = calculateAnnualCashFlow(input, midPercent);

    if (Math.abs(cashFlowAtMid) < CASH_FLOW_TOLERANCE) break;

    if (cashFlowAtMid < 0) {
      lowPercent = midPercent;
    } else {
      highPercent = midPercent;
    }
  }

  return midPercent;
}

/**
 * Walks the first year of the amortization schedule month by month, modeling
 * vacancyMonths as consecutive months of $0 rent at the start of the year
 * followed by full occupancy for the remainder, and returns the month at
 * which cumulative cash flow first reaches $0. See months_to_zero_cf on
 * BreakEvenResultDownPayment for the full contract (0 / null cases).
 */
function monthsToZeroCashFlow(input: BreakEvenInput): number | null {
  if (input.vacancyMonths <= 0) return 0;

  const loan = loanFor(input, input.downPaymentPercent);
  const schedule = amortizationSchedule(loan, input.country, 12);
  const monthlyFixedExpenses =
    (input.propertyTaxAnnual + input.insuranceAnnual + input.maintenanceAnnual + input.strataFeeAnnual) / 12;

  let cumulativeCashFlow = 0;
  for (let month = 1; month <= 12; month++) {
    const isVacant = month <= input.vacancyMonths;
    const rentCollected = isVacant ? 0 : input.monthlyRent;
    const propertyMgmtFee = rentCollected * input.propertyMgmtFeePercent;
    const debtServicePayment = schedule[month - 1].payment;

    cumulativeCashFlow += rentCollected - propertyMgmtFee - monthlyFixedExpenses - debtServicePayment;

    if (cumulativeCashFlow >= 0) return month;
  }

  return null;
}

/** Mode A: solve for the down payment percent needed to reach $0 annual cash flow. */
export function breakEvenDownPayment(input: BreakEvenInput): BreakEvenResultDownPayment {
  const downPctForZeroCF = solveDownPaymentForZeroCashFlow(input);

  return {
    down_pct_for_zero_cf: downPctForZeroCF,
    down_amt_needed: downPctForZeroCF * input.purchasePrice,
    current_annual_cf: calculateAnnualCashFlow(input),
    months_to_zero_cf: monthsToZeroCashFlow(input),
    down_pct_current: input.downPaymentPercent,
  };
}

/**
 * Mode B: solve for the monthly payment needed to reach $0 annual cash flow.
 * Pure algebra rather than a search: cash flow is 0 exactly when monthly
 * debt service equals NOI / 12.
 */
export function breakEvenMonthlyPayment(input: BreakEvenInput): BreakEvenResultMonthlyPayment {
  const monthlyPaymentForZeroCF = annualNOI(input) / 12;

  const loan = loanFor(input, input.downPaymentPercent);
  const currentMonthlyPayment = monthlyPaymentFor(loan, input.country);

  const monthlyShortfall = currentMonthlyPayment - monthlyPaymentForZeroCF;

  return {
    monthly_payment_for_zero_cf: monthlyPaymentForZeroCF,
    current_monthly_payment: currentMonthlyPayment,
    monthly_shortfall: monthlyShortfall,
    annual_shortfall: monthlyShortfall * 12,
    down_pct_current: input.downPaymentPercent,
  };
}

/** Dispatches to breakEvenDownPayment (Mode A) or breakEvenMonthlyPayment (Mode B). */
export function calculateBreakEven(input: BreakEvenInput, mode: BreakEvenMode = "down_payment"): BreakEvenResult {
  return mode === "down_payment" ? breakEvenDownPayment(input) : breakEvenMonthlyPayment(input);
}
