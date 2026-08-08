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

import { TrancheType } from "./E8-capitalstack.types";

export interface AmortizationRow {
  month: number;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  closingBalance: number;
}

/**
 * capitalstack.ts's Tranche has amount/rate but no amortizationYears (see
 * note above) — this is a local, amortization-specific shape rather than an
 * extension of that interface, since capitalstack.ts's simple
 * amount * rate interestCost model doesn't need a term.
 */
export interface AmortizingTranche {
  type: TrancheType;
  amount: number;
  annualRate: number;
  amortizationYears: number;
}

export interface TrancheAmortizationRow {
  period: number;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
}
