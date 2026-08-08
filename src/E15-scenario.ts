import { remainingBalance } from "./E2-amortization";
import { projectCashFlows } from "./E3-cashflow";
import { calculateAppreciation } from "./E13-appreciation";
import { calculateSalePrice } from "./E4-exit";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./E5-returns";
import {
  MortgageInput,
  DealParameters,
  ScenarioAssumptions,
  ScenarioInput,
  ScenarioOutcome,
  ScenarioComparisonResult,
} from "./types";

function loanFor(deal: DealParameters): MortgageInput {
  return {
    purchasePrice: deal.purchasePrice,
    downPaymentPercent: deal.downPaymentPercent,
    annualInterestRate: deal.annualInterestRate,
    amortizationYears: deal.amortizationYears,
  };
}

/**
 * Runs one scenario's cash flow projection (cashflow.ts), exit sale price
 * (appreciation.ts for flat growth, or exit.ts's calculateSalePrice for the
 * cap-rate method), remaining loan balance (amortization.ts), and
 * full-cycle IRR (returns.ts) against the shared baseDeal.
 */
function runScenario(
  baseDeal: DealParameters,
  holdPeriodYears: number,
  scenario: ScenarioAssumptions,
  sellingCostsPercent: number,
): ScenarioOutcome {
  const loan = loanFor(baseDeal);

  const projection = projectCashFlows({
    holdPeriodYears,
    grossAnnualRent: baseDeal.grossAnnualRent,
    vacancyRatePercent: baseDeal.vacancyRatePercent,
    annualOperatingExpenses: baseDeal.annualOperatingExpenses,
    rentGrowthRate: scenario.rentGrowthRate,
    expenseGrowthRate: scenario.expenseGrowthRate,
    loan,
    country: baseDeal.country,
  });

  const loanBalanceAtExit = remainingBalance(loan, baseDeal.country, holdPeriodYears * 12);

  let projectedSalePrice: number;
  let projectedEquity: number;
  let exitAssumptionText: string;

  if (scenario.exitCapRate === null) {
    const appreciation = calculateAppreciation({
      purchasePrice: baseDeal.purchasePrice,
      downPaymentPercent: baseDeal.downPaymentPercent,
      initialEquity: baseDeal.equityInvested,
      holdPeriodYears,
      annualAppreciationRate: scenario.appreciationRate,
      remainingLoanBalance: loanBalanceAtExit,
    });
    projectedSalePrice = appreciation.projectedSalePrice;
    projectedEquity = appreciation.projectedEquity;
    exitAssumptionText = `${(scenario.appreciationRate * 100).toFixed(1)}% annual appreciation`;
  } else {
    const finalYearNOI = projection[projection.length - 1].noi;
    projectedSalePrice = calculateSalePrice({ method: "cap_rate", finalYearNOI, exitCapRate: scenario.exitCapRate });
    projectedEquity = projectedSalePrice - loanBalanceAtExit;
    exitAssumptionText = `a ${(scenario.exitCapRate * 100).toFixed(2)}% exit cap rate`;
  }

  const cumulativeCashFlow = projection.reduce((sum, row) => sum + row.netCashFlow, 0);

  const series = buildInvestmentCashFlowSeries(baseDeal.equityInvested, projection, projectedEquity);
  const irr = calculateIRR(series);

  const cashOnCash = projection[0].netCashFlow / baseDeal.equityInvested;

  let projectedEquityNetOfSellingCosts: number | null;
  let warning: string;

  if (sellingCostsPercent > 0) {
    const sellingCosts = projectedSalePrice * sellingCostsPercent;
    projectedEquityNetOfSellingCosts = projectedEquity - sellingCosts;
    warning = `Selling costs of ${(sellingCostsPercent * 100).toFixed(1)}% ($${sellingCosts.toFixed(2)}) deducted from equity.`;
  } else {
    projectedEquityNetOfSellingCosts = null;
    warning = "Selling costs not included. Add realtor commission (~6%) for accurate net proceeds estimate.";
  }

  const summary =
    `"${scenario.name}": ${(scenario.rentGrowthRate * 100).toFixed(1)}% rent growth, ` +
    `${(scenario.expenseGrowthRate * 100).toFixed(1)}% expense growth, exit via ${exitAssumptionText} → ` +
    `projected sale price $${projectedSalePrice.toFixed(2)}, projected equity $${projectedEquity.toFixed(2)}, IRR ${(irr * 100).toFixed(2)}%.`;

  return {
    name: scenario.name,
    projectedSalePrice,
    projectedEquity,
    cumulativeCashFlow,
    irr,
    cashOnCash,
    summary,
    sellingCostsPercent,
    projectedEquityNetOfSellingCosts,
    warning,
  };
}

function buildRecommendation(outcomes: ScenarioOutcome[]): string {
  if (outcomes.every((o) => o.irr > 0)) return "All scenarios positive";
  if (outcomes.every((o) => o.irr < 0)) return "All scenarios negative";
  return "Mixed results";
}

export function calculateScenarioComparison(input: ScenarioInput): ScenarioComparisonResult {
  const sellingCostsPercent = input.sellingCostsPercent ?? 0;
  const scenarios = input.scenarios.map((scenario) =>
    runScenario(input.baseDeal, input.holdPeriodYears, scenario, sellingCostsPercent),
  );

  const bestCase = scenarios.reduce((best, s) => (s.irr > best.irr ? s : best)).name;
  const worstCase = scenarios.reduce((worst, s) => (s.irr < worst.irr ? s : worst)).name;

  return {
    scenarios,
    bestCase,
    worstCase,
    recommendation: buildRecommendation(scenarios),
  };
}
