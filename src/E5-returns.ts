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

import { YearlyCashFlow } from "./types";

/**
 * Internal rate of return via Newton-Raphson iteration — a proprietary
 * replacement for @formulajs/formulajs's IRR.
 *
 * IRR is the discount rate r that makes the net present value of a cash
 * flow series equal to zero:
 *
 *   NPV(r) = Σ values[i] / (1+r)^i     for i = 0..n
 *
 * Newton-Raphson refines a guess for r by repeatedly stepping toward the
 * root of NPV(r), using its exact analytic derivative:
 *
 *   NPV'(r) = Σ -i * values[i] / (1+r)^(i+1)   for i = 0..n
 *   r_new   = r - NPV(r) / NPV'(r)
 *
 * Each step moves r to where the tangent line at the current estimate
 * crosses zero, which converges quadratically once close to the true root
 * for well-behaved (single sign-change) cash flow series. Iteration stops
 * once successive estimates differ by less than `tolerance`; if that
 * hasn't happened after `maxIterations` steps, or the series doesn't admit
 * an IRR at all, this returns NaN rather than a value that hasn't actually
 * converged.
 *
 * @param values Cash flow series; values[0] is the period-0 outlay, values[1..n] are subsequent period flows.
 * @param guess Initial rate estimate, as a decimal. Defaults to 0.1 (10%).
 * @returns The IRR as a decimal (e.g. 0.12 for 12%), or NaN if it can't be found.
 */
export function IRR(values: number[], guess: number = 0.1): number {
  if (values.length === 0) return NaN;

  const hasPositive = values.some((cashFlow) => cashFlow > 0);
  const hasNegative = values.some((cashFlow) => cashFlow < 0);
  if (!hasPositive || !hasNegative) return NaN;

  const MAX_ITERATIONS = 100;
  const TOLERANCE = 1e-10;

  let rate = guess;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let npv = 0;
    let derivative = 0;

    for (let i = 0; i < values.length; i++) {
      const discountFactor = Math.pow(1 + rate, i);
      npv += values[i] / discountFactor;
      if (i > 0) {
        derivative += (-i * values[i]) / (discountFactor * (1 + rate));
      }
    }

    if (derivative === 0) return NaN;

    const nextRate = rate - npv / derivative;

    if (Math.abs(nextRate - rate) < TOLERANCE) {
      return nextRate;
    }

    rate = nextRate;
  }

  return NaN;
}

/**
 * Modified internal rate of return — a proprietary replacement for
 * @formulajs/formulajs's MIRR.
 *
 * Unlike IRR, MIRR doesn't assume interim cash flows are reinvested at the
 * IRR itself; it separates financing cost from reinvestment opportunity:
 *
 *   1. Discount every negative cash flow (outlays) back to period 0 at
 *      `financeRate` — the cost of the capital funding those outlays:
 *
 *        PV_negative = Σ values[i] / (1 + financeRate)^i    for values[i] < 0
 *
 *   2. Compound every positive cash flow (returns) forward to the final
 *      period n at `reinvestRate` — the return available on capital as it's
 *      received:
 *
 *        FV_positive = Σ values[i] * (1 + reinvestRate)^(n-i)   for values[i] > 0
 *
 *   3. MIRR is the single periodic rate that would grow |PV_negative| into
 *      |FV_positive| over n periods:
 *
 *        MIRR = (|FV_positive| / |PV_negative|)^(1/n) - 1
 *
 * @param values Cash flow series; values[0] is the period-0 outlay, values[1..n] are subsequent period flows.
 * @param financeRate Discount rate applied to negative cash flows (cost of financing), as a decimal.
 * @param reinvestRate Compounding rate applied to positive cash flows (reinvestment opportunity), as a decimal.
 * @returns The MIRR as a decimal (e.g. 0.12 for 12%), or NaN if it can't be computed.
 */
export function MIRR(values: number[], financeRate: number, reinvestRate: number): number {
  if (values.length === 0) return NaN;
  if (financeRate < 0 || reinvestRate < 0) return NaN;

  const hasNegative = values.some((cashFlow) => cashFlow < 0);
  const hasPositive = values.some((cashFlow) => cashFlow > 0);
  if (!hasNegative || !hasPositive) return NaN;

  const n = values.length - 1;

  let pvNegative = 0;
  let fvPositive = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] < 0) {
      pvNegative += values[i] / Math.pow(1 + financeRate, i);
    } else if (values[i] > 0) {
      fvPositive += values[i] * Math.pow(1 + reinvestRate, n - i);
    }
  }

  return Math.pow(Math.abs(fvPositive) / Math.abs(pvNegative), 1 / n) - 1;
}

/**
 * Builds the year-0..n series IRR/MIRR expect: a negative acquisition cost
 * (equity invested) at year 0, each year's net cash flow after debt
 * service, with the exit/reversion value added onto the final year.
 */
export function buildInvestmentCashFlowSeries(
  equityInvested: number,
  annualCashFlows: YearlyCashFlow[],
  exitValue: number
): number[] {
  const netCashFlows = annualCashFlows.map((cf) => cf.netCashFlow);
  netCashFlows[netCashFlows.length - 1] += exitValue;
  return [-equityInvested, ...netCashFlows];
}

export function calculateIRR(cashFlowSeries: number[], guess = 0.1): number {
  return IRR(cashFlowSeries, guess);
}

export function calculateMIRR(cashFlowSeries: number[], financeRate: number, reinvestRate: number): number {
  return MIRR(cashFlowSeries, financeRate, reinvestRate);
}

export function calculateEquityMultiple(equityInvested: number, cashFlowSeries: number[]): number {
  const totalCashReturned = cashFlowSeries.slice(1).reduce((sum, cf) => sum + cf, 0);
  return totalCashReturned / equityInvested;
}
