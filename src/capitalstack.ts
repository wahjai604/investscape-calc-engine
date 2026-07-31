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
  weightedAverageCost: number;
}

/**
 * weightedAverageCost is a simple weighted average of each tranche's rate by
 * its share of total capital — it is NOT WACC (F-102), since it has no
 * (1 − Tc) tax shield on debt tranches. If a true tax-adjusted WACC is
 * needed later, that's a separate calculation.
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

  const weightedAverageCost = trancheResults.reduce((sum, t) => sum + t.rate * t.capitalWeight, 0);

  return {
    tranches: trancheResults,
    totalCapital,
    totalDebtService,
    weightedAverageCost,
  };
}
