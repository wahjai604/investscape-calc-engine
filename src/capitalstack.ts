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
  blendedCostOfCapital: number;
}

/**
 * Total debt service only sums the debt tranches (senior + mezzanine) since
 * equity has no scheduled payment. Blended cost of capital is a WACC-style
 * weighted average across the whole stack, including equity's target
 * return, weighted by each tranche's share of total capital.
 */
export function calculateCapitalStack(tranches: Tranche[]): CapitalStackResult {
  const totalCapital = tranches.reduce((sum, t) => sum + t.amount, 0);

  const trancheResults: TrancheResult[] = tranches.map((t) => ({
    ...t,
    interestCost: t.amount * t.rate,
    capitalWeight: t.amount / totalCapital,
  }));

  const totalDebtService = trancheResults
    .filter((t) => t.type !== "equity")
    .reduce((sum, t) => sum + t.interestCost, 0);

  const blendedCostOfCapital = trancheResults.reduce((sum, t) => sum + t.rate * t.capitalWeight, 0);

  return {
    tranches: trancheResults,
    totalCapital,
    totalDebtService,
    blendedCostOfCapital,
  };
}
