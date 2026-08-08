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

import { NOIInput } from "./E9-dscr.types";
import { MortgageInput, MortgageCountry } from "./common.types";

interface CashFlowProjectionInputBase extends NOIInput {
  holdPeriodYears: number;
  rentGrowthRate: number;
  expenseGrowthRate: number;
}

/** Legacy path: caller supplies a flat annual debt service figure directly. */
export interface FlatDebtServiceInput extends CashFlowProjectionInputBase {
  annualDebtService: number;
}

/** Real path (E9): debt service, and its interest/principal split, come from amortizationSchedule(). */
export interface RealDebtServiceInput extends CashFlowProjectionInputBase {
  loan: MortgageInput;
  country: MortgageCountry;
}

export type CashFlowProjectionInput = FlatDebtServiceInput | RealDebtServiceInput;
