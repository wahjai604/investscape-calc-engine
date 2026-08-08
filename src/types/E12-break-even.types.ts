import { MortgageCountry } from "./common.types";

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
