/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { evaluateBudgetLineItem, calculateBudgetRollup } from "../src/E80-budget-actuals";
import { BudgetLineItem } from "../src/types";

describe("evaluateBudgetLineItem", () => {
  it("a line item exactly at budget: variance 0, on_track, nothing left to complete", () => {
    const item: BudgetLineItem = {
      category: "Soft Costs",
      description: "Warranty + HPO",
      budgetedAmount: 144375,
      actualAmount: 144375,
      committedAmount: 0,
    };

    const result = evaluateBudgetLineItem(item);
    expect(result.variance).toBe(0);
    expect(result.varianceLabel).toBe("on_track");
    expect(result.toCompleteAmount).toBe(0);
    expect(result.overageAmount).toBe(0);
  });

  it("a line item over budget: negative variance beyond the on-track band grades 'over', with overageAmount surfaced (not silently floored away)", () => {
    const item: BudgetLineItem = {
      category: "Hard Costs",
      description: "General requirements",
      budgetedAmount: 100000,
      actualAmount: 110000,
      committedAmount: 0,
    };

    const result = evaluateBudgetLineItem(item);
    expect(result.variance).toBe(-10000);
    expect(result.varianceLabel).toBe("over");
    // budgeted - actual - committed = -10,000 → floored at 0, overage surfaced separately.
    expect(result.toCompleteAmount).toBe(0);
    expect(result.overageAmount).toBe(10000);
  });

  it("a line item under budget: positive variance beyond the on-track band grades 'under', with the leftover in toCompleteAmount", () => {
    const item: BudgetLineItem = {
      category: "Hard Costs",
      description: "General requirements",
      budgetedAmount: 100000,
      actualAmount: 80000,
      committedAmount: 0,
    };

    const result = evaluateBudgetLineItem(item);
    expect(result.variance).toBe(20000);
    expect(result.varianceLabel).toBe("under");
    expect(result.toCompleteAmount).toBe(20000);
    expect(result.overageAmount).toBe(0);
  });

  it("on-track band boundary: variance exactly at 2% of budgeted is on_track; one dollar past it is not", () => {
    const budgetedAmount = 100000;

    const atThreshold = evaluateBudgetLineItem({
      category: "Hard Costs",
      description: "At threshold",
      budgetedAmount,
      actualAmount: budgetedAmount - 2000, // exactly 2% under
      committedAmount: 0,
    });
    expect(atThreshold.variance).toBe(2000);
    expect(atThreshold.varianceLabel).toBe("on_track");

    const pastThreshold = evaluateBudgetLineItem({
      category: "Hard Costs",
      description: "Past threshold",
      budgetedAmount,
      actualAmount: budgetedAmount - 2001, // just past 2% under
      committedAmount: 0,
    });
    expect(pastThreshold.variance).toBe(2001);
    expect(pastThreshold.varianceLabel).toBe("under");
  });

  it("a zero-budgeted line uses the absolute-dollar on-track floor instead of a 0% (always-over) threshold", () => {
    const withinFloor = evaluateBudgetLineItem({
      category: "Soft Costs",
      description: "Unbudgeted, small spend",
      budgetedAmount: 0,
      actualAmount: 500, // == BUDGET_VARIANCE_ON_TRACK_ABSOLUTE_FLOOR
      committedAmount: 0,
    });
    expect(withinFloor.varianceLabel).toBe("on_track");

    const pastFloor = evaluateBudgetLineItem({
      category: "Soft Costs",
      description: "Unbudgeted, real spend",
      budgetedAmount: 0,
      actualAmount: 501,
      committedAmount: 0,
    });
    expect(pastFloor.varianceLabel).toBe("over");
  });

  it("committedAmount can push a line over even while its actual-only variance still reads 'under' — surfaced via overageAmount, not hidden", () => {
    const item: BudgetLineItem = {
      category: "Hard Costs",
      description: "Heavily committed but lightly invoiced",
      budgetedAmount: 100000,
      actualAmount: 50000,
      committedAmount: 60000,
    };

    const result = evaluateBudgetLineItem(item);
    expect(result.variance).toBe(50000);
    expect(result.varianceLabel).toBe("under");
    expect(result.toCompleteAmount).toBe(0);
    expect(result.overageAmount).toBe(10000);
  });
});

describe("calculateBudgetRollup", () => {
  // The old mockup's real line items (796 Main Street budget table).
  const lineItems: BudgetLineItem[] = [
    { category: "Hard Costs", description: "General requirements", budgetedAmount: 35404980, actualAmount: 8912400, committedAmount: 24100000 },
    { category: "Hard Costs", description: "Hard contingency", budgetedAmount: 1795249, actualAmount: 682195, committedAmount: 0, isContingencyLine: true },
    { category: "Soft Costs", description: "DCLs — market residential", budgetedAmount: 2048896, actualAmount: 0, committedAmount: 2048896 },
    { category: "Soft Costs", description: "Warranty + HPO", budgetedAmount: 144375, actualAmount: 0, committedAmount: 0 },
    { category: "Soft Costs", description: "Soft contingency", budgetedAmount: 322403, actualAmount: 0, committedAmount: 0, isContingencyLine: true },
    { category: "Financing", description: "Interest budget — 1st mortgage", budgetedAmount: 3232174, actualAmount: 418600, committedAmount: 0 },
  ];

  it("totals reconcile: sum of per-line budgeted/actual/committed equals the roll-up totals", () => {
    const result = calculateBudgetRollup(lineItems);

    const expectedBudgeted = lineItems.reduce((s, i) => s + i.budgetedAmount, 0);
    const expectedActual = lineItems.reduce((s, i) => s + i.actualAmount, 0);
    const expectedCommitted = lineItems.reduce((s, i) => s + i.committedAmount, 0);

    expect(result.totalBudgeted).toBeCloseTo(expectedBudgeted, 2);
    expect(result.totalActual).toBeCloseTo(expectedActual, 2);
    expect(result.totalCommitted).toBeCloseTo(expectedCommitted, 2);
    expect(result.totalVariance).toBeCloseTo(expectedBudgeted - expectedActual, 2);
  });

  it("groups per-category subtotals correctly", () => {
    const result = calculateBudgetRollup(lineItems);

    const hardCosts = result.categorySubtotals.find((c) => c.category === "Hard Costs")!;
    expect(hardCosts.totalBudgeted).toBeCloseTo(35404980 + 1795249, 2);
    expect(hardCosts.totalActual).toBeCloseTo(8912400 + 682195, 2);

    const softCosts = result.categorySubtotals.find((c) => c.category === "Soft Costs")!;
    expect(softCosts.totalBudgeted).toBeCloseTo(2048896 + 144375 + 322403, 2);

    const financing = result.categorySubtotals.find((c) => c.category === "Financing")!;
    expect(financing.totalBudgeted).toBeCloseTo(3232174, 2);

    expect(result.categorySubtotals).toHaveLength(3);
  });

  it("contingencyDrawnPercent aggregates only isContingencyLine items, matching the mockup's hand-computed figure", () => {
    const result = calculateBudgetRollup(lineItems);

    // (682,195 + 0) / (1,795,249 + 322,403) = 682,195 / 2,117,652
    const expected = 682195 / (1795249 + 322403);
    expect(result.contingencyDrawnPercent).toBeCloseTo(expected, 6);
  });

  it("contingencyDrawnPercent is 0% when every contingency line has zero actual spend", () => {
    const zeroSpend: BudgetLineItem[] = [
      { category: "Hard Costs", description: "Hard contingency", budgetedAmount: 100000, actualAmount: 0, committedAmount: 0, isContingencyLine: true },
    ];
    const result = calculateBudgetRollup(zeroSpend);
    expect(result.contingencyDrawnPercent).toBe(0);
  });

  it("contingencyDrawnPercent is 100% when contingency actual exactly matches contingency budgeted", () => {
    const fullySpent: BudgetLineItem[] = [
      { category: "Hard Costs", description: "Hard contingency", budgetedAmount: 100000, actualAmount: 100000, committedAmount: 0, isContingencyLine: true },
    ];
    const result = calculateBudgetRollup(fullySpent);
    expect(result.contingencyDrawnPercent).toBe(1);
  });

  it("contingencyDrawnPercent is null (not 0%) when no line item is flagged as contingency — insufficient data, not a silent zero", () => {
    const noContingency: BudgetLineItem[] = [
      { category: "Hard Costs", description: "General requirements", budgetedAmount: 100000, actualAmount: 50000, committedAmount: 0 },
    ];
    const result = calculateBudgetRollup(noContingency);
    expect(result.contingencyDrawnPercent).toBeNull();
  });

  it("an empty budget rolls up to all-zero totals and a null contingency figure, not a crash", () => {
    const result = calculateBudgetRollup([]);
    expect(result.totalBudgeted).toBe(0);
    expect(result.totalActual).toBe(0);
    expect(result.contingencyDrawnPercent).toBeNull();
    expect(result.categorySubtotals).toHaveLength(0);
  });
});
