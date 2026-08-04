import { DealParameters } from "./scenario";
import { MortgageInput } from "./mortgage";
import { remainingBalance } from "./amortization";
import { projectCashFlows } from "./cashflow";
import { calculateAppreciation } from "./appreciation";
import { calculateSalePrice } from "./exit";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./returns";

const MIN_HOLD_YEARS = 1;
const MAX_HOLD_YEARS = 30;

export interface HoldingPeriodSensitivityInput {
  /** Same shape as scenario.ts's DealParameters — full financing + operating metrics, held constant across every hold period tested. */
  baseDeal: DealParameters;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  appreciationRate: number;
  /** Cap rate used to value the exit at every hold length (salePrice = finalYearNOI / exitCapRate). null uses flat appreciationRate compounding instead. */
  exitCapRate: number | null;
  /** Defaults to 0. e.g. 0.06 for a 6% realtor commission, applied uniformly at every hold length. */
  sellingCostsPercent?: number;
}

export interface HoldPeriodOutcome {
  holdYears: number;
  /** Sum of netCashFlow across every year of this hold period (operating cash flow only, before the exit/sale). */
  cumulativeCashFlow: number;
  /** projectedSalePrice - remaining loan balance at this hold length. Gross of selling costs. */
  projectedEquity: number;
  /** projectedEquity - (projectedSalePrice × sellingCostsPercent). null when sellingCostsPercent is 0. */
  projectedEquityNetOfSellingCosts: number | null;
  /** Full-cycle IRR for exiting at this hold length: -equityInvested at year 0, each year's netCashFlow, plus (gross) projectedEquity added to the final year. */
  irr: number;
  /** Year 1 netCashFlow / equityInvested. Identical across every hold length here, since rentGrowthRate/expenseGrowthRate are fixed inputs shared by all of them (not per-hold-period assumptions). */
  cashOnCash: number;
  /** This hold length's final-year NOI divided by its own projected sale price (property value at exit), not a fixed purchase-price-based cap rate. */
  capRate: number;
}

export interface HoldingPeriodSensitivityResult {
  /** One entry per hold length from 1 to 30 years. */
  holdPeriodAnalysis: HoldPeriodOutcome[];
  /** The holdYears value (not an array index) with the highest IRR. */
  bestHoldPeriodByIRR: number;
  irr_at_5_years: number;
  irr_at_10_years: number;
  /** First holdYears (1-30) where cumulativeCashFlow >= baseDeal.equityInvested. null if that never happens within 30 years. */
  breakEvenYear: number | null;
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
 * Runs the deal out to exactly holdYears: cash flow projection (cashflow.ts),
 * exit sale price (appreciation.ts for flat growth, or exit.ts's
 * calculateSalePrice for the cap-rate method), remaining loan balance
 * (amortization.ts — naturally clamps to ~$0 once holdYears exceeds the
 * loan's own amortizationYears, so long holds correctly reflect a paid-off
 * property), and full-cycle IRR (returns.ts).
 */
function runForHoldYears(
  input: HoldingPeriodSensitivityInput,
  holdYears: number,
  sellingCostsPercent: number,
): HoldPeriodOutcome {
  const { baseDeal } = input;
  const loan = loanFor(baseDeal);

  const projection = projectCashFlows({
    holdPeriodYears: holdYears,
    grossAnnualRent: baseDeal.grossAnnualRent,
    vacancyRatePercent: baseDeal.vacancyRatePercent,
    annualOperatingExpenses: baseDeal.annualOperatingExpenses,
    rentGrowthRate: input.rentGrowthRate,
    expenseGrowthRate: input.expenseGrowthRate,
    loan,
    country: baseDeal.country,
  });

  const loanBalanceAtExit = remainingBalance(loan, baseDeal.country, holdYears * 12);

  let projectedSalePrice: number;
  let projectedEquity: number;

  if (input.exitCapRate === null) {
    const appreciation = calculateAppreciation({
      purchasePrice: baseDeal.purchasePrice,
      downPaymentPercent: baseDeal.downPaymentPercent,
      initialEquity: baseDeal.equityInvested,
      holdPeriodYears: holdYears,
      annualAppreciationRate: input.appreciationRate,
      remainingLoanBalance: loanBalanceAtExit,
    });
    projectedSalePrice = appreciation.projectedSalePrice;
    projectedEquity = appreciation.projectedEquity;
  } else {
    const finalYearNOI = projection[projection.length - 1].noi;
    projectedSalePrice = calculateSalePrice({ method: "cap_rate", finalYearNOI, exitCapRate: input.exitCapRate });
    projectedEquity = projectedSalePrice - loanBalanceAtExit;
  }

  const projectedEquityNetOfSellingCosts =
    sellingCostsPercent > 0 ? projectedEquity - projectedSalePrice * sellingCostsPercent : null;

  const cumulativeCashFlow = projection.reduce((sum, row) => sum + row.netCashFlow, 0);

  const series = buildInvestmentCashFlowSeries(baseDeal.equityInvested, projection, projectedEquity);
  const irr = calculateIRR(series);

  const cashOnCash = projection[0].netCashFlow / baseDeal.equityInvested;
  const capRate = projection[projection.length - 1].noi / projectedSalePrice;

  return {
    holdYears,
    cumulativeCashFlow,
    projectedEquity,
    projectedEquityNetOfSellingCosts,
    irr,
    cashOnCash,
    capRate,
  };
}

export function calculateHoldingPeriodSensitivity(input: HoldingPeriodSensitivityInput): HoldingPeriodSensitivityResult {
  const sellingCostsPercent = input.sellingCostsPercent ?? 0;

  const holdPeriodAnalysis: HoldPeriodOutcome[] = [];
  for (let holdYears = MIN_HOLD_YEARS; holdYears <= MAX_HOLD_YEARS; holdYears++) {
    holdPeriodAnalysis.push(runForHoldYears(input, holdYears, sellingCostsPercent));
  }

  const bestHoldPeriodByIRR = holdPeriodAnalysis.reduce((best, o) => (o.irr > best.irr ? o : best)).holdYears;

  const irrAt5Years = holdPeriodAnalysis.find((o) => o.holdYears === 5);
  const irrAt10Years = holdPeriodAnalysis.find((o) => o.holdYears === 10);
  if (!irrAt5Years || !irrAt10Years) {
    throw new Error("holdPeriodAnalysis is expected to always include 5- and 10-year entries (range is 1-30 years)");
  }

  const breakEvenEntry = holdPeriodAnalysis.find((o) => o.cumulativeCashFlow >= input.baseDeal.equityInvested);
  const breakEvenYear = breakEvenEntry ? breakEvenEntry.holdYears : null;

  return {
    holdPeriodAnalysis,
    bestHoldPeriodByIRR,
    irr_at_5_years: irrAt5Years.irr,
    irr_at_10_years: irrAt10Years.irr,
    breakEvenYear,
  };
}
