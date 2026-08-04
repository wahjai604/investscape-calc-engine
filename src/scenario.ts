import { MortgageInput } from "./mortgage";
import { MortgageCountry, remainingBalance } from "./amortization";
import { projectCashFlows } from "./cashflow";
import { calculateAppreciation } from "./appreciation";
import { calculateSalePrice } from "./exit";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./returns";

/**
 * Everything that stays constant across scenarios — the property, its
 * financing, and its current operating numbers. Only rentGrowthRate,
 * expenseGrowthRate, appreciationRate, and exitCapRate vary per scenario
 * (see ScenarioAssumptions). Not literally spelled out in the E18 spec
 * ("standard deal object with all parameters"), so this shape is derived
 * from what the engines it wires together (cashflow.ts, appreciation.ts,
 * exit.ts, amortization.ts) actually require.
 */
export interface DealParameters {
  purchasePrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  amortizationYears: number;
  country: MortgageCountry;
  grossAnnualRent: number;
  vacancyRatePercent: number;
  annualOperatingExpenses: number;
  /** Down payment + closing costs — the actual cash invested at purchase. */
  equityInvested: number;
}

export interface ScenarioAssumptions {
  /** e.g. "Base" | "Optimistic" | "Pessimistic", or any user-defined label. */
  name: string;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  appreciationRate: number;
  /** Cap rate used to value the exit (salePrice = finalYearNOI / exitCapRate). null uses flat appreciationRate compounding instead. */
  exitCapRate: number | null;
}

export interface ScenarioInput {
  baseDeal: DealParameters;
  scenarios: ScenarioAssumptions[];
  holdPeriodYears: number;
  /** Defaults to 0. e.g. 0.06 for a 6% realtor commission, applied uniformly to every scenario's projectedSalePrice. */
  sellingCostsPercent?: number;
}

export interface ScenarioOutcome {
  name: string;
  projectedSalePrice: number;
  /** projectedSalePrice - remaining loan balance at exit. Gross of selling costs — ScenarioInput has no sellingCostsRate field (unlike exit.ts's calculateExitProceeds()). */
  projectedEquity: number;
  /** Sum of netCashFlow across every year of the hold period (operating cash flow only, before the exit/sale). */
  cumulativeCashFlow: number;
  /** Full-cycle IRR: -equityInvested at year 0, each year's netCashFlow, plus projectedEquity added to the final year. */
  irr: number;
  /** Year 1 netCashFlow / equityInvested. Note: year 1 is unaffected by rentGrowthRate/expenseGrowthRate (cashflow.ts only compounds growth starting year 2), so this is identical across scenarios that share the same baseDeal — it's appreciationRate/exitCapRate/cumulative growth that actually differentiate scenarios, not year-1 cash-on-cash. */
  cashOnCash: number;
  summary: string;
  /** The sellingCostsPercent this outcome was computed with (echoes ScenarioInput.sellingCostsPercent, defaulted to 0 if omitted). */
  sellingCostsPercent: number;
  /** projectedEquity - (projectedSalePrice × sellingCostsPercent). null when sellingCostsPercent is 0 — there's nothing to net out, and null (vs. 0) keeps "not modeled" distinguishable from "modeled and it's zero". */
  projectedEquityNetOfSellingCosts: number | null;
  /** Explains whether selling costs were deducted, and prompts for a realistic rate if not. */
  warning: string;
}

export interface ScenarioComparisonResult {
  scenarios: ScenarioOutcome[];
  /** Name of the scenario with the highest IRR. */
  bestCase: string;
  /** Name of the scenario with the lowest IRR. */
  worstCase: string;
  /** "All scenarios positive" | "Mixed results" | "All scenarios negative", based on each scenario's IRR sign. */
  recommendation: string;
}

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
