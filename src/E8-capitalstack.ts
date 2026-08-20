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

import { Tranche, TrancheResult, CapitalStackResult } from "./types";

/**
 * taxRate (Tc) is optional because not every caller has a corporate tax
 * rate on hand; when omitted, wacc is null and weightedAverageCost (the
 * pre-existing, untaxed figure) is still available for callers that don't
 * need the tax-adjusted version.
 */
export function calculateCapitalStack(tranches: Tranche[], taxRate?: number): CapitalStackResult {
  const totalCapital = tranches.reduce((sum, t) => sum + t.amount, 0);

  const trancheResults: TrancheResult[] = tranches.map((t) => {
    const commitmentFeeAmount = t.amount * (t.commitmentFeePercent ?? 0);

    return {
      ...t,
      interestCost: t.amount * t.rate,
      capitalWeight: t.amount / totalCapital,
      commitmentFeeAmount,
      netAdvance: t.amount - (t.interestReserveAmount ?? 0) - commitmentFeeAmount,
    };
  });

  const totalDebtService = trancheResults
    .filter((t) => t.type !== "equity")
    .reduce((sum, t) => sum + t.interestCost, 0);

  const weightedAverageCost = trancheResults.reduce((sum, t) => sum + t.rate * t.capitalWeight, 0);

  const wacc =
    taxRate === undefined
      ? null
      : trancheResults.reduce((sum, t) => {
          const afterTaxRate = t.type === "equity" ? t.rate : t.rate * (1 - taxRate);
          return sum + afterTaxRate * t.capitalWeight;
        }, 0);

  return {
    tranches: trancheResults,
    totalCapital,
    totalDebtService,
    weightedAverageCost,
    wacc,
  };
}
