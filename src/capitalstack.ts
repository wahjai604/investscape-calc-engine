export type TrancheType = "senior_debt" | "mezzanine" | "equity";

export interface Tranche {
  type: TrancheType;
  amount: number;
  rate: number;
}

export interface TrancheResult extends Tranche {
  interestCost: number;
  capitalWeight: number;
}

export interface CapitalStackResult {
  tranches: TrancheResult[];
  totalCapital: number;
  totalDebtService: number;
  /** Simple weighted average of each tranche's rate by its share of total capital — NOT tax-adjusted. See wacc for that. */
  weightedAverageCost: number;
  /**
   * True tax-adjusted WACC (F-102): debt tranches (senior_debt, mezzanine)
   * get the (1 − Tc) interest tax shield applied to their rate before
   * weighting; equity does not, since equity distributions aren't a
   * tax-deductible expense. null when no taxRate is supplied — WACC isn't
   * meaningful without one, so this doesn't silently fall back to the
   * untaxed figure under a "wacc" name.
   */
  wacc: number | null;
}

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
