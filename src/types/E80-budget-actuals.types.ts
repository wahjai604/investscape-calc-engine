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

export type BudgetVarianceLabel = "over" | "under" | "on_track";

/**
 * One itemized development-budget line (e.g. "General requirements", "DCLs
 * — market residential", "Warranty + HPO") — the old mockup's real
 * per-line table, not one aggregate bucket.
 */
export interface BudgetLineItem {
  /** Free-form grouping, e.g. "Hard Costs" / "Soft Costs" / "Financing" — not a fixed enum, since the real budget groups vary by jurisdiction and project type. */
  category: string;
  description: string;
  budgetedAmount: number;
  actualAmount: number;
  /** Contractually obligated but not yet spent (e.g. an executed subcontract not yet invoiced). */
  committedAmount: number;
  /**
   * Explicit opt-in flag for calculateBudgetRollup()'s contingencyDrawnPercent.
   * Deliberately a real per-line flag rather than inferring "is this a
   * contingency line" from category text — a keyword match against
   * "contingency" would silently miscategorize a line whose label doesn't
   * happen to contain that word, or over-match one that mentions it in
   * passing. undefined/false = not a contingency line.
   */
  isContingencyLine?: boolean;
}

export interface BudgetLineItemEvaluation extends BudgetLineItem {
  /**
   * budgetedAmount - actualAmount - committedAmount, floored at 0 — the
   * amount still available to spend at this line's currently budgeted
   * level. Never negative; see overageAmount for how far over budgeted
   * this line already is once actual + committed exceed it.
   */
  toCompleteAmount: number;
  /**
   * budgetedAmount - actualAmount - committedAmount when that figure is
   * negative, expressed as a positive dollar amount (0 when not over).
   * Surfaced explicitly rather than letting toCompleteAmount's floor
   * silently absorb an over-budget/over-committed line into "$0 left",
   * which would look identical to a line that's exactly used up its
   * budget with nothing overspent.
   */
  overageAmount: number;
  /** budgetedAmount - actualAmount. Positive = under budget so far; negative = over. Does NOT factor in committedAmount — see overageAmount for that (a line can be "under" on variance while still over-committed). */
  variance: number;
  varianceLabel: BudgetVarianceLabel;
}

export interface BudgetCategorySubtotal {
  category: string;
  totalBudgeted: number;
  totalActual: number;
  totalCommitted: number;
  totalToComplete: number;
  totalOverage: number;
}

export interface BudgetRollupResult {
  lineItems: BudgetLineItemEvaluation[];
  totalBudgeted: number;
  totalActual: number;
  totalCommitted: number;
  totalToComplete: number;
  totalOverage: number;
  /** totalBudgeted - totalActual, graded with the same on_track/over/under bracket evaluateBudgetLineItem() uses per line. */
  totalVariance: number;
  overallVarianceLabel: BudgetVarianceLabel;
  /**
   * Σ actualAmount ÷ Σ budgetedAmount across every line item with
   * isContingencyLine === true — the old mockup's "Contingency drawn %"
   * badge. null when there are no contingency line items at all, or their
   * combined budgetedAmount is 0 (nothing to divide by) — insufficient
   * data, not a silently-reported 0%.
   */
  contingencyDrawnPercent: number | null;
  categorySubtotals: BudgetCategorySubtotal[];
}
