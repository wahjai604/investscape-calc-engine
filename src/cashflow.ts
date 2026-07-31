import { NOIInput, calculateNOI } from "./dscr";

export interface CashFlowProjectionInput extends NOIInput {
  holdPeriodYears: number;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  annualDebtService: number;
}

export interface YearlyCashFlow {
  year: number;
  grossRent: number;
  vacancyAllowance: number;
  operatingExpenses: number;
  noi: number;
  debtService: number;
  netCashFlow: number;
}

/**
 * Rent and operating expenses are grown independently year over year (each
 * compounding off its own starting value at its own rate); the vacancy rate
 * itself is held constant across the hold period and applied to the grown
 * rent each year. Debt service is assumed constant, matching a fixed-rate
 * loan over the hold period.
 */
export function projectCashFlows(input: CashFlowProjectionInput): YearlyCashFlow[] {
  const {
    holdPeriodYears,
    grossAnnualRent,
    vacancyRatePercent,
    annualOperatingExpenses,
    rentGrowthRate,
    expenseGrowthRate,
    annualDebtService,
  } = input;

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

    projection.push({
      year,
      grossRent,
      vacancyAllowance,
      operatingExpenses,
      noi,
      debtService: annualDebtService,
      netCashFlow: noi - annualDebtService,
    });
  }

  return projection;
}
