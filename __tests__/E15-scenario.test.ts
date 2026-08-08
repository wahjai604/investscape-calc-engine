import { calculateScenarioComparison } from "../src/E15-scenario";
import { ScenarioInput, DealParameters, ScenarioAssumptions } from "../src/types";

// Same $550,000 / 27.5% down / 4.54% / 25yr Canadian loan used as the golden
// case throughout this session (mortgage.test.ts, break-even.test.ts, etc.).
const baseDeal: DealParameters = {
  purchasePrice: 550000,
  downPaymentPercent: 0.275,
  annualInterestRate: 0.0454,
  amortizationYears: 25,
  country: "Canada",
  grossAnnualRent: 42000,
  vacancyRatePercent: 0.05,
  annualOperatingExpenses: 15000,
  equityInvested: 162250,
};

const typicalScenarios: ScenarioAssumptions[] = [
  { name: "Base", rentGrowthRate: 0.02, expenseGrowthRate: 0.03, appreciationRate: 0.03, exitCapRate: null },
  { name: "Optimistic", rentGrowthRate: 0.04, expenseGrowthRate: 0.02, appreciationRate: 0.05, exitCapRate: null },
  { name: "Pessimistic", rentGrowthRate: 0, expenseGrowthRate: 0.04, appreciationRate: 0.01, exitCapRate: null },
];

describe("calculateScenarioComparison", () => {
  describe("typical usage (base/optimistic/pessimistic)", () => {
    const result = calculateScenarioComparison({ baseDeal, holdPeriodYears: 5, scenarios: typicalScenarios });

    it("ranks IRR as Pessimistic < Base < Optimistic", () => {
      const [base, optimistic, pessimistic] = result.scenarios;
      expect(pessimistic.irr).toBeLessThan(base.irr);
      expect(base.irr).toBeLessThan(optimistic.irr);
    });

    it("identifies bestCase/worstCase by name", () => {
      expect(result.bestCase).toBe("Optimistic");
      expect(result.worstCase).toBe("Pessimistic");
    });

    it("recommends when every scenario has positive IRR", () => {
      expect(result.recommendation).toBe("All scenarios positive");
    });

    it("Base scenario matches independently verified golden figures", () => {
      const base = result.scenarios[0];
      expect(base.projectedSalePrice).toBeCloseTo(637600.74, 2);
      expect(base.projectedEquity).toBeCloseTo(287281.21, 2);
      expect(base.irr).toBeCloseTo(0.11576, 4);
    });

    it("cashOnCash is identical across scenarios sharing the same baseDeal (year 1 predates any growth compounding)", () => {
      const [base, optimistic, pessimistic] = result.scenarios;
      expect(base.cashOnCash).toBeCloseTo(optimistic.cashOnCash, 10);
      expect(base.cashOnCash).toBeCloseTo(pessimistic.cashOnCash, 10);
    });
  });

  it("cap rate exit method produces a different sale price than flat appreciation for the same scenario", () => {
    const flatResult = calculateScenarioComparison({
      baseDeal,
      holdPeriodYears: 5,
      scenarios: [{ name: "Flat", rentGrowthRate: 0.02, expenseGrowthRate: 0.03, appreciationRate: 0.03, exitCapRate: null }],
    });
    const capRateResult = calculateScenarioComparison({
      baseDeal,
      holdPeriodYears: 5,
      scenarios: [{ name: "CapRate", rentGrowthRate: 0.02, expenseGrowthRate: 0.03, appreciationRate: 0.03, exitCapRate: 0.05 }],
    });

    expect(capRateResult.scenarios[0].projectedSalePrice).not.toBeCloseTo(flatResult.scenarios[0].projectedSalePrice, 0);
  });

  it("single scenario (just base case): bestCase equals worstCase equals that scenario", () => {
    const result = calculateScenarioComparison({
      baseDeal,
      holdPeriodYears: 5,
      scenarios: [typicalScenarios[0]],
    });

    expect(result.bestCase).toBe("Base");
    expect(result.worstCase).toBe("Base");
    expect(result.scenarios).toHaveLength(1);
  });

  it("mixed results: warns when scenarios disagree in sign", () => {
    const strugglingDeal: DealParameters = { ...baseDeal, grossAnnualRent: 30000 };
    const result = calculateScenarioComparison({
      baseDeal: strugglingDeal,
      holdPeriodYears: 5,
      scenarios: [
        { name: "Base", rentGrowthRate: 0.02, expenseGrowthRate: 0.03, appreciationRate: 0.03, exitCapRate: null },
        { name: "Pessimistic", rentGrowthRate: -0.02, expenseGrowthRate: 0.06, appreciationRate: -0.01, exitCapRate: null },
      ],
    });

    expect(result.scenarios[0].irr).toBeGreaterThan(0);
    expect(result.scenarios[1].irr).toBeLessThan(0);
    expect(result.recommendation).toBe("Mixed results");
  });

  it("all scenarios negative: warns accordingly", () => {
    const badDeal: DealParameters = { ...baseDeal, grossAnnualRent: 20000 };
    const result = calculateScenarioComparison({
      baseDeal: badDeal,
      holdPeriodYears: 5,
      scenarios: [
        { name: "Base", rentGrowthRate: 0, expenseGrowthRate: 0.05, appreciationRate: 0, exitCapRate: null },
        { name: "Pessimistic", rentGrowthRate: -0.02, expenseGrowthRate: 0.06, appreciationRate: -0.02, exitCapRate: null },
      ],
    });

    expect(result.scenarios.every((s) => s.irr < 0)).toBe(true);
    expect(result.recommendation).toBe("All scenarios negative");
  });

  describe("sensitivity: rent growth vs expense growth vs appreciation", () => {
    function irrFor(overrides: Partial<ScenarioAssumptions>): number {
      const scenario: ScenarioAssumptions = {
        name: "A",
        rentGrowthRate: 0.02,
        expenseGrowthRate: 0.03,
        appreciationRate: 0.03,
        exitCapRate: null,
        ...overrides,
      };
      return calculateScenarioComparison({ baseDeal, holdPeriodYears: 5, scenarios: [scenario] }).scenarios[0].irr;
    }

    it("higher rent growth increases IRR", () => {
      expect(irrFor({ rentGrowthRate: 0.05 })).toBeGreaterThan(irrFor({ rentGrowthRate: 0.01 }));
    });

    it("higher expense growth decreases IRR", () => {
      expect(irrFor({ expenseGrowthRate: 0.06 })).toBeLessThan(irrFor({ expenseGrowthRate: 0.01 }));
    });

    it("higher appreciation increases IRR", () => {
      expect(irrFor({ appreciationRate: 0.06 })).toBeGreaterThan(irrFor({ appreciationRate: 0.01 }));
    });

    it("appreciation has a much larger effect on IRR than rent or expense growth over the same range, since it drives a lump-sum exit value rather than incremental annual cash flow", () => {
      const rentSwing = irrFor({ rentGrowthRate: 0.05 }) - irrFor({ rentGrowthRate: 0.01 });
      const expenseSwing = irrFor({ expenseGrowthRate: 0.01 }) - irrFor({ expenseGrowthRate: 0.06 });
      const appreciationSwing = irrFor({ appreciationRate: 0.06 }) - irrFor({ appreciationRate: 0.01 });

      expect(appreciationSwing).toBeGreaterThan(rentSwing);
      expect(appreciationSwing).toBeGreaterThan(expenseSwing);
    });
  });

  describe("selling costs handling", () => {
    it("6% selling costs: net equity calculated, warning shows the deduction", () => {
      const result = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        sellingCostsPercent: 0.06,
      });
      const outcome = result.scenarios[0];

      expect(outcome.sellingCostsPercent).toBe(0.06);
      // sellingCosts = 637,600.740865 * 0.06 = 38,256.04445...; net = 287,281.2062608175 - that.
      expect(outcome.projectedEquityNetOfSellingCosts).toBeCloseTo(249025.16, 2);
      expect(outcome.projectedEquityNetOfSellingCosts).toBeCloseTo(
        outcome.projectedEquity - outcome.projectedSalePrice * 0.06,
        6,
      );
      expect(outcome.warning).toBe("Selling costs of 6.0% ($38256.04) deducted from equity.");
    });

    it("0% selling costs (default, field omitted): net equity is null, warning prompts to add a realistic rate", () => {
      const result = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        // sellingCostsPercent omitted entirely
      });
      const outcome = result.scenarios[0];

      expect(outcome.sellingCostsPercent).toBe(0);
      expect(outcome.projectedEquityNetOfSellingCosts).toBeNull();
      expect(outcome.warning).toBe(
        "Selling costs not included. Add realtor commission (~6%) for accurate net proceeds estimate.",
      );
    });

    it("explicit 0% behaves the same as omitting the field entirely", () => {
      const omitted = calculateScenarioComparison({ baseDeal, holdPeriodYears: 5, scenarios: [typicalScenarios[0]] });
      const explicitZero = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        sellingCostsPercent: 0,
      });

      expect(explicitZero.scenarios[0]).toEqual(omitted.scenarios[0]);
    });

    it("3% selling costs: calculated correctly", () => {
      const result = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        sellingCostsPercent: 0.03,
      });
      const outcome = result.scenarios[0];

      expect(outcome.sellingCostsPercent).toBe(0.03);
      // sellingCosts = 637,600.740865 * 0.03 = 19,128.0222...; net = 287,281.2062608175 - that.
      expect(outcome.projectedEquityNetOfSellingCosts).toBeCloseTo(268153.18, 2);
      expect(outcome.warning).toBe("Selling costs of 3.0% ($19128.02) deducted from equity.");
    });

    it("applies uniformly across every scenario in the comparison, not just the first", () => {
      const result = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: typicalScenarios,
        sellingCostsPercent: 0.06,
      });

      for (const outcome of result.scenarios) {
        expect(outcome.sellingCostsPercent).toBe(0.06);
        expect(outcome.projectedEquityNetOfSellingCosts).not.toBeNull();
        expect(outcome.projectedEquityNetOfSellingCosts).toBeCloseTo(
          outcome.projectedEquity - outcome.projectedSalePrice * 0.06,
          6,
        );
      }
    });

    it("gross projectedEquity and irr are unaffected by sellingCostsPercent — selling costs are reported alongside, not folded into the existing fields", () => {
      const withoutCosts = calculateScenarioComparison({ baseDeal, holdPeriodYears: 5, scenarios: [typicalScenarios[0]] });
      const withCosts = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        sellingCostsPercent: 0.06,
      });

      expect(withCosts.scenarios[0].projectedEquity).toBe(withoutCosts.scenarios[0].projectedEquity);
      expect(withCosts.scenarios[0].irr).toBe(withoutCosts.scenarios[0].irr);
    });

    it("warning text is actionable: the zero-cost case names a concrete suggested rate, the nonzero case states the exact dollar deduction", () => {
      const zero = calculateScenarioComparison({ baseDeal, holdPeriodYears: 5, scenarios: [typicalScenarios[0]] });
      const nonzero = calculateScenarioComparison({
        baseDeal,
        holdPeriodYears: 5,
        scenarios: [typicalScenarios[0]],
        sellingCostsPercent: 0.05,
      });

      expect(zero.scenarios[0].warning).toContain("~6%");
      expect(nonzero.scenarios[0].warning).toMatch(/\$\d+\.\d{2}/);
      expect(nonzero.scenarios[0].warning).toContain("5.0%");
    });
  });
});
