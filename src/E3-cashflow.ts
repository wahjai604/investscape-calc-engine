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

import { calculateNOI } from "./E9-dscr";
import { amortizationSchedule } from "./E2-amortization";
import { YearlyCashFlow, CashFlowProjectionInput, FlatDebtServiceInput, RealDebtServiceInput } from "./types";

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
