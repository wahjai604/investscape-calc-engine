import { PMT } from "@formulajs/formulajs";
import { MortgageInput } from "./types";

/**
 * Canadian mortgages compound semi-annually by law/convention, not monthly,
 * so the nominal annual rate must first be converted to an effective
 * monthly rate before amortizing.
 */
export function semiAnnualToMonthlyRate(annualInterestRate: number): number {
  return Math.pow(1 + annualInterestRate / 2, 1 / 6) - 1;
}

export function calculateMonthlyMortgagePayment(input: MortgageInput): number {
  const { purchasePrice, downPaymentPercent, annualInterestRate, amortizationYears } = input;

  const principal = purchasePrice * (1 - downPaymentPercent);
  const monthlyRate = semiAnnualToMonthlyRate(annualInterestRate);
  const numberOfPayments = amortizationYears * 12;

  const payment = PMT(monthlyRate, numberOfPayments, -principal);
  return payment as number;
}

/**
 * US mortgages compound monthly, so the nominal annual rate converts to a
 * monthly rate by simple division rather than the Canadian semi-annual
 * conversion above.
 */
export function monthlyCompoundingRate(annualInterestRate: number): number {
  return annualInterestRate / 12;
}

export function calculateMonthlyUSMortgagePayment(input: MortgageInput): number {
  const { purchasePrice, downPaymentPercent, annualInterestRate, amortizationYears } = input;

  const principal = purchasePrice * (1 - downPaymentPercent);
  const monthlyRate = monthlyCompoundingRate(annualInterestRate);
  const numberOfPayments = amortizationYears * 12;

  const payment = PMT(monthlyRate, numberOfPayments, -principal);
  return payment as number;
}
