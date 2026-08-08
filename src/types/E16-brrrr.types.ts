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
