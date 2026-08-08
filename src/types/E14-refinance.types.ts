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

import { MortgageCountry } from "./common.types";

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
