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

export interface AmortizationRow {
  month: number;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  closingBalance: number;
}

// AmortizingTranche (a local amount/annualRate/amortizationYears shape,
// parallel to capitalstack.ts's Tranche) has been removed. The schema gap
// this used to paper over — Tranche having no amortizationYears field — is
// resolved directly on Tranche in E8-capitalstack.types.ts, so
// trancheAmortizationSchedule() below now takes a Tranche.

export interface TrancheAmortizationRow {
  period: number;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
}

/**
 * One period of a presale_deposit facility's schedule. Unlike
 * TrancheAmortizationRow, there is no principal component and balances
 * don't decline period over period — drawnBalance only steps up when a
 * milestone releases more of the trust, and the facility is retired in one
 * bullet repayment (repaid: true on the final row), not paid down
 * gradually.
 */
export interface PresaleDepositScheduleRow {
  period: number;
  /** Cumulative amount released from trust and outstanding as of this period, per the facility's milestones. */
  drawnBalance: number;
  /** Interest-only accrual for this period: drawnBalance * the facility's monthly rate. */
  interestAccrued: number;
  cumulativeInterest: number;
  /** True only on the final row, when the outstanding drawnBalance is retired in a single bullet repayment. */
  repaid: boolean;
}
