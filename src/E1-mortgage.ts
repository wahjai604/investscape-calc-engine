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

import { MortgageInput } from "./types";

/**
 * Periodic payment for an annuity — a proprietary replacement for
 * @formulajs/formulajs's PMT, matching its output exactly.
 *
 * rate = 0 (zero-interest loan):
 *   payment = -(pv + fv) / nper
 *
 * rate ≠ 0:
 *   payment = -[ pv * rate * (1+rate)^nper / ((1+rate)^nper - 1)
 *                + fv * rate / ((1+rate)^nper - 1) ] / (1 + rate * type)
 *
 * With fv = 0 and type = 0 this reduces to the standard mortgage-payment
 * formula: PMT = -pv * i * (1+i)^n / ((1+i)^n - 1), where i is the periodic
 * rate and n is the number of periods.
 *
 * pv is conventionally negative (the loan principal as a cash outflow to
 * the borrower), which is what makes the returned payment positive.
 *
 * @param rate Periodic interest rate as a decimal (e.g. 0.00417 for 5%/yr compounded monthly).
 * @param nper Total number of payment periods.
 * @param pv Present value (loan principal) — negative in typical mortgage usage.
 * @param fv Future value / balloon amount remaining after the last payment. Defaults to 0.
 * @param type 0 = payments due at the end of each period (default), 1 = payments due at the start of each period.
 * @returns The periodic payment amount.
 */
export function PMT(rate: number, nper: number, pv: number, fv: number = 0, type: number = 0): number {
  if (rate === 0) {
    return -(pv + fv) / nper;
  }

  const term = Math.pow(1 + rate, nper);
  const result = (fv * rate) / (term - 1) + (pv * rate) / (1 - 1 / term);

  return -(type === 1 ? result / (1 + rate) : result);
}

/**
 * Present value of a level-payment annuity given its periodic payment — the
 * inverse of PMT() above, solved for pv instead of payment. Used wherever a
 * lender caps a loan by a maximum payment/debt-service figure rather than a
 * maximum principal (e.g. E83's commercial DSCR test: NOI ÷ minDscr gives a
 * maximum annual debt service, which must be converted back into a maximum
 * loan principal).
 *
 * rate = 0 (zero-interest loan):
 *   pv = payment * nper
 *
 * rate ≠ 0:
 *   pv = payment * (1 - (1+rate)^-nper) / rate
 *
 * @param rate Periodic interest rate as a decimal.
 * @param nper Total number of payment periods.
 * @param payment The known periodic payment (positive).
 * @returns The present value (loan principal) that produces that payment — positive.
 */
export function presentValueFromPayment(rate: number, nper: number, payment: number): number {
  if (rate === 0) {
    return payment * nper;
  }

  return (payment * (1 - Math.pow(1 + rate, -nper))) / rate;
}

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

  return PMT(monthlyRate, numberOfPayments, -principal);
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

  return PMT(monthlyRate, numberOfPayments, -principal);
}
