import { Tranche, TrancheResult, CapitalStackResult } from "./types";

/**
 * taxRate (Tc) is optional because not every caller has a corporate tax
 * rate on hand; when omitted, wacc is null and weightedAverageCost (the
 * pre-existing, untaxed figure) is still available for callers that don't
 * need the tax-adjusted version.
 */
export function calculateCapitalStack(tranches: Tranche[], taxRate?: number): CapitalStackResult {
  const totalCapital = tranches.reduce((sum, t) => sum + t.amount, 0);

  const trancheResults: TrancheResult[] = tranches.map((t) => ({
    ...t,
    interestCost: t.amount * t.rate,
    capitalWeight: t.amount / totalCapital,
  }));

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
