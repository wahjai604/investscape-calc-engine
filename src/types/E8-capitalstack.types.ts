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
