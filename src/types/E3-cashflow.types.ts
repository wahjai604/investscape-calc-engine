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
