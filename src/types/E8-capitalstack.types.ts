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
