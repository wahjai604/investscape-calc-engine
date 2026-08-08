import { calculateIRR } from "./E5-returns";
import { CurrencyCode, FXConversionInput, CurrencyMetrics, FXSensitivity, FXConversionResult } from "./types";
import {
  BISECTION_IRR_TOLERANCE,
  FX_MAX_BISECTION_ITERATIONS,
  RATE_SEARCH_MIN_MULTIPLE,
  RATE_SEARCH_MAX_MULTIPLE,
} from "./utils/constants";

type ConversionMode = "identity" | "multiply" | "divide";

function conversionModeFor(dealCurrency: CurrencyCode, investorCurrency: CurrencyCode): ConversionMode {
  if (dealCurrency === investorCurrency) return "identity";
  return dealCurrency === "USD" && investorCurrency === "CAD" ? "multiply" : "divide";
}

function convert(amount: number, rate: number, mode: ConversionMode): number {
  if (mode === "identity") return amount;
  return mode === "multiply" ? amount * rate : amount / rate;
}

/**
 * Builds an investor-currency cash flow series with the entry outflow
 * locked in at entryRate (the rate at purchase) but every subsequent cash
 * flow (annual cash flow + exit equity) converted at exitRate instead —
 * modeling real unhedged FX risk, where the rate can move between
 * purchase and the cash actually being received/repatriated.
 */
function buildInvestorCurrencySeriesAtExitRate(
  input: FXConversionInput,
  entryRate: number,
  exitRate: number,
  mode: ConversionMode,
): number[] {
  const { annualCashFlow, projectedEquity, holdPeriodYears, equityInvested } = input.dealMetrics;

  const entryOutflow = -convert(equityInvested, entryRate, mode);
  const annualInInvestorCurrency = convert(annualCashFlow, exitRate, mode);

  const series = [entryOutflow, ...Array<number>(holdPeriodYears).fill(annualInInvestorCurrency)];
  series[series.length - 1] += convert(projectedEquity, exitRate, mode);
  return series;
}

function irrAtExitRate(input: FXConversionInput, entryRate: number, exitRate: number, mode: ConversionMode): number {
  return calculateIRR(buildInvestorCurrencySeriesAtExitRate(input, entryRate, exitRate, mode));
}

/**
 * Bisection search over the exit-time FX rate for the rate that makes the
 * investor-currency IRR equal targetIRR. IRR moves monotonically with
 * exitRate — increasing when the deal->investor conversion is a
 * multiplication, decreasing when it's a division — which is what makes
 * bisection valid here. When dealCurrency === investorCurrency there's no
 * FX exposure at all (every rate produces the same IRR), so this returns
 * 1.0 — the only rate that's ever actually in effect — rather than
 * attempting to solve an equation with no unique solution.
 */
function solveRateForTargetIRR(input: FXConversionInput, targetIRR: number, entryRate: number, mode: ConversionMode): number {
  if (mode === "identity") return 1.0;

  const increasing = mode === "multiply";
  const rawLow = entryRate * RATE_SEARCH_MIN_MULTIPLE;
  const rawHigh = entryRate * RATE_SEARCH_MAX_MULTIPLE;

  const irrAtRawLow = irrAtExitRate(input, entryRate, rawLow, mode);
  const irrAtRawHigh = irrAtExitRate(input, entryRate, rawHigh, mode);

  const belowRate = increasing ? rawLow : rawHigh;
  const aboveRate = increasing ? rawHigh : rawLow;
  const irrBelow = increasing ? irrAtRawLow : irrAtRawHigh;
  const irrAbove = increasing ? irrAtRawHigh : irrAtRawLow;

  if (targetIRR <= irrBelow) return belowRate;
  if (targetIRR >= irrAbove) return aboveRate;

  let low = belowRate;
  let high = aboveRate;
  let mid = (low + high) / 2;

  for (let i = 0; i < FX_MAX_BISECTION_ITERATIONS; i++) {
    mid = (low + high) / 2;
    const irrAtMid = irrAtExitRate(input, entryRate, mid, mode);

    if (Math.abs(irrAtMid - targetIRR) < BISECTION_IRR_TOLERANCE) break;

    if (irrAtMid < targetIRR) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return mid;
}

/**
 * Two things worth reading before the formulas below:
 *
 * 1. Currency conversion (dealMetricsInDealCurrency/InInvestorCurrency) is
 *    a plain point-in-time multiply-or-divide by fxRate, and irr is
 *    identical in both blocks — per the E23 spec's own rule that IRR "is
 *    already a %" and isn't converted by a currency multiplier (scaling
 *    every cash flow in a series by a constant doesn't change the rate
 *    that solves NPV=0 for it).
 *
 * 2. fxSensitivity is a different calculation, not a contradiction of
 *    point 1: it asks what happens if the FX rate moves BETWEEN entry and
 *    exit (real unhedged FX risk), which needs its own reconstructed cash
 *    flow series — entry converted at the given fxRate, exit-year cash
 *    flows converted at a hypothetical different rate — rather than a
 *    single constant multiplier applied to everything. See
 *    buildInvestorCurrencySeriesAtExitRate(). holdPeriodYears was added
 *    to DealMetrics to make that series constructible; it isn't in the
 *    original E23 field list. When dealCurrency === investorCurrency
 *    there's no FX exposure, so every fxSensitivity figure reduces to the
 *    unconverted deal IRR / a rate of 1.0.
 */
export function calculateFXConversion(input: FXConversionInput): FXConversionResult {
  const mode = conversionModeFor(input.dealCurrency, input.investorCurrency);
  const effectiveFxRate = mode === "identity" ? 1.0 : input.fxRate;
  const { purchasePrice, annualCashFlow, projectedEquity, irr } = input.dealMetrics;

  const dealMetricsInDealCurrency: CurrencyMetrics = { purchasePrice, cashFlow: annualCashFlow, equity: projectedEquity, irr };

  const dealMetricsInInvestorCurrency: CurrencyMetrics = {
    purchasePrice: convert(purchasePrice, effectiveFxRate, mode),
    cashFlow: convert(annualCashFlow, effectiveFxRate, mode),
    equity: convert(projectedEquity, effectiveFxRate, mode),
    irr,
  };

  const plusFiveRate = effectiveFxRate * 1.05;
  const minusFiveRate = effectiveFxRate * 0.95;

  const fxSensitivity: FXSensitivity = {
    rateIfIRRTarget5percent: solveRateForTargetIRR(input, 0.05, effectiveFxRate, mode),
    rateIfIRRTarget10percent: solveRateForTargetIRR(input, 0.1, effectiveFxRate, mode),
    irrAt_plus5pct_rate: irrAtExitRate(input, effectiveFxRate, plusFiveRate, mode),
    irrAt_minus5pct_rate: irrAtExitRate(input, effectiveFxRate, minusFiveRate, mode),
  };

  const summary =
    `In ${input.dealCurrency}: $${dealMetricsInDealCurrency.purchasePrice.toFixed(2)} purchase, ${(dealMetricsInDealCurrency.irr * 100).toFixed(2)}% IRR. ` +
    `In ${input.investorCurrency}: $${dealMetricsInInvestorCurrency.purchasePrice.toFixed(2)} purchase, ${(dealMetricsInInvestorCurrency.irr * 100).toFixed(2)}% IRR (same % — a currency conversion doesn't change a ratio). ` +
    `FX sensitivity: +5% rate move → ${(fxSensitivity.irrAt_plus5pct_rate * 100).toFixed(2)}% IRR, -5% rate move → ${(fxSensitivity.irrAt_minus5pct_rate * 100).toFixed(2)}% IRR.`;

  return {
    dealCurrency: input.dealCurrency,
    investorCurrency: input.investorCurrency,
    fxRate: effectiveFxRate,
    dealMetricsInDealCurrency,
    dealMetricsInInvestorCurrency,
    fxSensitivity,
    summary,
  };
}
