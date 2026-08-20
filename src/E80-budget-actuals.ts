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

import {
  BudgetLineItem,
  BudgetLineItemEvaluation,
  BudgetVarianceLabel,
  BudgetCategorySubtotal,
  BudgetRollupResult,
} from "./types";
import { BUDGET_VARIANCE_ON_TRACK_PERCENT, BUDGET_VARIANCE_ON_TRACK_ABSOLUTE_FLOOR } from "./utils/constants";

function varianceLabelFor(variance: number, budgetedAmount: number): BudgetVarianceLabel {
  const threshold =
    budgetedAmount === 0
      ? BUDGET_VARIANCE_ON_TRACK_ABSOLUTE_FLOOR
      : Math.abs(budgetedAmount) * BUDGET_VARIANCE_ON_TRACK_PERCENT;

  if (Math.abs(variance) <= threshold) return "on_track";
  return variance > 0 ? "under" : "over";
}

/**
 * budgeted - actual - committed, split into its two mutually-exclusive
 * halves: whatever's still available to spend (never negative), and
 * whatever's already been overspent/over-committed past budget (0 when
 * there's no overage). Never floors overage away — that's the explicit
 * "not silently" handling the over-budget/over-committed case needs.
 */
function completionFigures(item: BudgetLineItem): { toCompleteAmount: number; overageAmount: number } {
  const remaining = item.budgetedAmount - item.actualAmount - item.committedAmount;
  return remaining >= 0 ? { toCompleteAmount: remaining, overageAmount: 0 } : { toCompleteAmount: 0, overageAmount: -remaining };
}

export function evaluateBudgetLineItem(item: BudgetLineItem): BudgetLineItemEvaluation {
  const variance = item.budgetedAmount - item.actualAmount;
  const varianceLabel = varianceLabelFor(variance, item.budgetedAmount);
  const { toCompleteAmount, overageAmount } = completionFigures(item);

  return { ...item, toCompleteAmount, overageAmount, variance, varianceLabel };
}

function emptySubtotal(category: string): BudgetCategorySubtotal {
  return { category, totalBudgeted: 0, totalActual: 0, totalCommitted: 0, totalToComplete: 0, totalOverage: 0 };
}

function buildCategorySubtotals(lineItems: BudgetLineItemEvaluation[]): BudgetCategorySubtotal[] {
  const byCategory = new Map<string, BudgetCategorySubtotal>();

  for (const item of lineItems) {
    const subtotal = byCategory.get(item.category) ?? emptySubtotal(item.category);
    subtotal.totalBudgeted += item.budgetedAmount;
    subtotal.totalActual += item.actualAmount;
    subtotal.totalCommitted += item.committedAmount;
    subtotal.totalToComplete += item.toCompleteAmount;
    subtotal.totalOverage += item.overageAmount;
    byCategory.set(item.category, subtotal);
  }

  return [...byCategory.values()];
}

function contingencyDrawnPercentFor(lineItems: BudgetLineItemEvaluation[]): number | null {
  const contingencyLines = lineItems.filter((item) => item.isContingencyLine);
  if (contingencyLines.length === 0) return null;

  const budgeted = contingencyLines.reduce((sum, item) => sum + item.budgetedAmount, 0);
  if (budgeted === 0) return null;

  const actual = contingencyLines.reduce((sum, item) => sum + item.actualAmount, 0);
  return actual / budgeted;
}

/**
 * Aggregates a development budget's itemized line items into the roll-up
 * view: totals, overall variance, the mockup's "Contingency drawn %"
 * badge, and per-category subtotals. Ground-zero build — no prior "budget"
 * concept existed anywhere in this engine to extend or reconcile with.
 */
export function calculateBudgetRollup(lineItems: BudgetLineItem[]): BudgetRollupResult {
  const evaluatedLineItems = lineItems.map(evaluateBudgetLineItem);

  const totalBudgeted = evaluatedLineItems.reduce((sum, i) => sum + i.budgetedAmount, 0);
  const totalActual = evaluatedLineItems.reduce((sum, i) => sum + i.actualAmount, 0);
  const totalCommitted = evaluatedLineItems.reduce((sum, i) => sum + i.committedAmount, 0);
  const totalToComplete = evaluatedLineItems.reduce((sum, i) => sum + i.toCompleteAmount, 0);
  const totalOverage = evaluatedLineItems.reduce((sum, i) => sum + i.overageAmount, 0);

  const totalVariance = totalBudgeted - totalActual;
  const overallVarianceLabel = varianceLabelFor(totalVariance, totalBudgeted);

  return {
    lineItems: evaluatedLineItems,
    totalBudgeted,
    totalActual,
    totalCommitted,
    totalToComplete,
    totalOverage,
    totalVariance,
    overallVarianceLabel,
    contingencyDrawnPercent: contingencyDrawnPercentFor(evaluatedLineItems),
    categorySubtotals: buildCategorySubtotals(evaluatedLineItems),
  };
}
