import { remainingBalance } from "./E2-amortization";
import { projectCashFlows } from "./E3-cashflow";
import { calculateAppreciation } from "./E13-appreciation";
import { calculateSalePrice } from "./E4-exit";
import { buildInvestmentCashFlowSeries, calculateIRR } from "./E5-returns";
import {
  MortgageInput,
  DealParameters,
  HoldingPeriodSensitivityInput,
  HoldPeriodOutcome,
  HoldingPeriodSensitivityResult,
} from "./types";
import { MIN_HOLD_YEARS, MAX_HOLD_YEARS } from "./utils/constants";

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
