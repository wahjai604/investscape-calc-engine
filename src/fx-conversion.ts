import { calculateIRR } from "./returns";

export type CurrencyCode = "CAD" | "USD";
export type FXRateSource = "user_input" | "market_current" | "historical_average";

export interface DealMetrics {
  purchasePrice: number;
  annualCashFlow: number;
  projectedEquity: number;
  /** Pre-FX IRR, already computed in dealCurrency by the caller — this module doesn't recompute it for the headline figures, only reconstructs an independent series for FX-sensitivity purposes (see calculateFXConversion's JSDoc). */
  irr: number;
  /**
   * Not in the original E23 field list — added because fxSensitivity's
   * "what FX rate yields a target IRR" / "IRR if rate moves ±5%" fields
   * are only meaningful with a real multi-year cash flow series to run an
   * entry-vs-exit-rate scenario through. See calculateFXConversion's
   * JSDoc for the full explanation.
   */
  holdPeriodYears: number;
  /**
   * Also not in the original field list. purchasePrice isn't the right
   * entry-year cash outflow for reconstructing an IRR series — real deals
   * are financed, so the actual t=0 cash outflow is equityInvested (down
   * payment + closing costs), not the full purchase price. Using
   * purchasePrice there instead produces a wildly different (and much
   * worse) IRR than an unlevered deal's real return, which defeats the
   * purpose of fxSensitivity showing a meaningful delta around the deal's
   * actual known IRR. purchasePrice itself is still used, unchanged, for
   * the plain currency-conversion display fields.
   */
  equityInvested: number;
}

export interface FXConversionInput {
  dealMetrics: DealMetrics;
  dealCurrency: CurrencyCode;
  /** Currency the investor reports in. */
  investorCurrency: CurrencyCode;
  /** e.g. 1.36 means 1 USD = 1.36 CAD. */
  fxRate: number;
  fxRateSource: FXRateSource;
}

export interface CurrencyMetrics {
  purchasePrice: number;
  cashFlow: number;
  equity: number;
  irr: number;
}

export interface FXSensitivity {
  /** Hypothetical exit-time FX rate at which the investor-currency IRR would equal 5%, holding the entry rate fixed at fxRate. 1.0 when dealCurrency === investorCurrency — there's no FX exposure to solve over. */
  rateIfIRRTarget5percent: number;
  rateIfIRRTarget10percent: number;
  /** Investor-currency IRR if the exit-time FX rate is fxRate × 1.05 instead of fxRate (entry still locked in at fxRate). */
  irrAt_plus5pct_rate: number;
  irrAt_minus5pct_rate: number;
}

export interface FXConversionResult {
  dealCurrency: string;
  investorCurrency: string;
  /** 1.0 when dealCurrency === investorCurrency, regardless of whatever was passed in input.fxRate — matches "no conversion needed, fxRate = 1.0". */
  fxRate: number;
  dealMetricsInDealCurrency: CurrencyMetrics;
  dealMetricsInInvestorCurrency: CurrencyMetrics;
  fxSensitivity: FXSensitivity;
  summary: string;
}

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

const BISECTION_IRR_TOLERANCE = 0.0001;
const MAX_BISECTION_ITERATIONS = 100;
const RATE_SEARCH_MIN_MULTIPLE = 0.1;
const RATE_SEARCH_MAX_MULTIPLE = 10;

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

  for (let i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
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
