import { NOIInput, calculateNOI } from "./dscr";
import { MortgageInput } from "./mortgage";
import { MortgageCountry, amortizationSchedule } from "./amortization";

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

export interface YearlyCashFlow {
  year: number;
  grossRent: number;
  vacancyAllowance: number;
  operatingExpenses: number;
  noi: number;
  /**
   * Full annual P&I payment. Doc 01 Part B defines debt_service_annual as
   * the full payment (B6 Break-Even Ratio, B10 ROE both subtract/add it
   * that way) — a real cash outflow includes principal, not just interest
   * — so this stays the full payment even when it's sourced from a real
   * amortization schedule (RealDebtServiceInput). Do not change this to
   * interest-only; that's what interestPaid is for.
   */
  debtService: number;
  /**
   * Real per-year interest/principal split from amortizationSchedule() —
   * only present for RealDebtServiceInput. undefined for the legacy flat
   * annualDebtService path, since there's no schedule to split.
   */
  interestPaid?: number;
  principalPaid?: number;
  netCashFlow: number;
}

function isRealDebtServiceInput(input: CashFlowProjectionInput): input is RealDebtServiceInput {
  return "loan" in input && "country" in input;
}

/**
 * Rent and operating expenses are grown independently year over year (each
 * compounding off its own starting value at its own rate); the vacancy rate
 * itself is held constant across the hold period and applied to the grown
 * rent each year.
 */
export function projectCashFlows(input: CashFlowProjectionInput): YearlyCashFlow[] {
  const { holdPeriodYears, grossAnnualRent, vacancyRatePercent, annualOperatingExpenses, rentGrowthRate, expenseGrowthRate } =
    input;

  const schedule = isRealDebtServiceInput(input)
    ? amortizationSchedule(input.loan, input.country, holdPeriodYears * 12)
    : null;

  const projection: YearlyCashFlow[] = [];

  for (let year = 1; year <= holdPeriodYears; year++) {
    const rentGrowthFactor = Math.pow(1 + rentGrowthRate, year - 1);
    const expenseGrowthFactor = Math.pow(1 + expenseGrowthRate, year - 1);

    const grossRent = grossAnnualRent * rentGrowthFactor;
    const operatingExpenses = annualOperatingExpenses * expenseGrowthFactor;
    const vacancyAllowance = grossRent * vacancyRatePercent;
    const noi = calculateNOI({
      grossAnnualRent: grossRent,
      vacancyRatePercent,
      annualOperatingExpenses: operatingExpenses,
    });

    let debtService: number;
    let interestPaid: number | undefined;
    let principalPaid: number | undefined;

    if (schedule) {
      const yearRows = schedule.slice((year - 1) * 12, year * 12);
      debtService = yearRows.reduce((sum, row) => sum + row.payment, 0);
      interestPaid = yearRows.reduce((sum, row) => sum + row.interestPaid, 0);
      principalPaid = yearRows.reduce((sum, row) => sum + row.principalPaid, 0);
    } else {
      debtService = (input as FlatDebtServiceInput).annualDebtService;
    }

    const row: YearlyCashFlow = {
      year,
      grossRent,
      vacancyAllowance,
      operatingExpenses,
      noi,
      debtService,
      netCashFlow: noi - debtService,
    };
    if (interestPaid !== undefined) row.interestPaid = interestPaid;
    if (principalPaid !== undefined) row.principalPaid = principalPaid;

    projection.push(row);
  }

  return projection;
}
