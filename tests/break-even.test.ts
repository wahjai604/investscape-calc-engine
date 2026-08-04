import {
  breakEvenDownPayment,
  breakEvenMonthlyPayment,
  calculateBreakEven,
  calculateAnnualCashFlow,
  BreakEvenInput,
} from "../src/break-even";
import { calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "../src/mortgage";

// Template v2 golden case: same $550,000 / 27.5% down / 4.54% / 25yr Canadian
// loan that mortgage.test.ts validates against the FCAC calculator
// ($2,215.85/mo), plus Template v2's default 10% property management fee
// (levied on collected, post-vacancy rent).
const templateV2: BreakEvenInput = {
  purchasePrice: 550000,
  downPaymentPercent: 0.275,
  annualInterestRate: 0.0454,
  amortizationYears: 25,
  country: "Canada",
  monthlyRent: 3000,
  vacancyMonths: 1,
  propertyTaxAnnual: 3600,
  insuranceAnnual: 1200,
  maintenanceAnnual: 2400,
  propertyMgmtFeePercent: 0.1,
  strataFeeAnnual: 550,
};

describe("breakEvenDownPayment", () => {
  it("Template v2 golden case: solves down% for zero CF at the 10% management fee", () => {
    const result = breakEvenDownPayment(templateV2);

    // At a 10% management fee, breakeven requires meaningfully more equity than
    // the self-managed (0% fee) case did — down_pct_for_zero_cf lands around 40%.
    expect(result.down_pct_for_zero_cf).toBeGreaterThanOrEqual(0.39);
    expect(result.down_pct_for_zero_cf).toBeLessThanOrEqual(0.41);
    expect(result.down_pct_for_zero_cf).toBeCloseTo(0.4015, 3);
  });

  it("Template v2 golden case: down_amt_needed is down_pct_for_zero_cf applied to purchase price", () => {
    const result = breakEvenDownPayment(templateV2);
    expect(result.down_amt_needed).toBeCloseTo(result.down_pct_for_zero_cf * templateV2.purchasePrice, 6);
  });

  it("Template v2 golden case: current_annual_cf and down_pct_current reflect the input's actual down payment", () => {
    const result = breakEvenDownPayment(templateV2);
    expect(result.current_annual_cf).toBeCloseTo(-4640.19, 2);
    expect(result.down_pct_current).toBe(0.275);
  });

  it("negative CF scenario: when $0 CF is unreachable even at 95% down, clamps to the 95% boundary", () => {
    // Rent this low can't cover fixed opex regardless of how little is financed.
    const deeplyNegative: BreakEvenInput = { ...templateV2, monthlyRent: 800 };

    expect(calculateAnnualCashFlow(deeplyNegative)).toBeLessThan(0);
    expect(calculateAnnualCashFlow(deeplyNegative, 0.95)).toBeLessThan(0);

    const result = breakEvenDownPayment(deeplyNegative);
    expect(result.down_pct_for_zero_cf).toBe(0.95);
    expect(result.down_amt_needed).toBeCloseTo(0.95 * templateV2.purchasePrice, 6);
    expect(result.current_annual_cf).toBeLessThan(0);
  });

  it("positive CF scenario: when CF is already positive at 5% down, clamps to the 5% boundary", () => {
    const deeplyPositive: BreakEvenInput = { ...templateV2, monthlyRent: 6000 };

    expect(calculateAnnualCashFlow(deeplyPositive)).toBeGreaterThan(0);
    expect(calculateAnnualCashFlow(deeplyPositive, 0.05)).toBeGreaterThan(0);

    const result = breakEvenDownPayment(deeplyPositive);
    expect(result.down_pct_for_zero_cf).toBe(0.05);
    expect(result.down_amt_needed).toBeCloseTo(0.05 * templateV2.purchasePrice, 6);
    expect(result.current_annual_cf).toBeGreaterThan(0);
  });

  it("US property (6.5% rate, 30yr amortization): solves a higher down% than the Canadian golden case", () => {
    const usInput: BreakEvenInput = { ...templateV2, country: "US", annualInterestRate: 0.065, amortizationYears: 30 };
    const canadaResult = breakEvenDownPayment(templateV2);
    const usResult = breakEvenDownPayment(usInput);

    // Same NOI, but a costlier loan (higher rate, same term family) needs more equity to zero out.
    expect(usResult.down_pct_for_zero_cf).toBeGreaterThan(canadaResult.down_pct_for_zero_cf);
    expect(usResult.down_pct_for_zero_cf).toBeGreaterThan(0.05);
    expect(usResult.down_pct_for_zero_cf).toBeLessThan(0.95);
    expect(usResult.down_amt_needed).toBeCloseTo(usResult.down_pct_for_zero_cf * templateV2.purchasePrice, 6);
    expect(usResult.current_annual_cf).toBeLessThan(0);
  });

  describe("months_to_zero_cf", () => {
    it("is 0 when there is no vacancy to recover from", () => {
      const noVacancy: BreakEvenInput = { ...templateV2, vacancyMonths: 0 };
      expect(breakEvenDownPayment(noVacancy).months_to_zero_cf).toBe(0);
    });

    it("is null when cumulative cash flow never turns positive within the 12-month year", () => {
      // Template v2's own current down% (27.5%) never recovers within the year at this rent level.
      expect(breakEvenDownPayment(templateV2).months_to_zero_cf).toBeNull();

      // Nor does a property whose rent can't cover fixed costs even post-vacancy.
      const deeplyNegative: BreakEvenInput = { ...templateV2, monthlyRent: 800 };
      expect(breakEvenDownPayment(deeplyNegative).months_to_zero_cf).toBeNull();
    });

    it("returns the month cumulative cash flow first turns non-negative, once occupied", () => {
      // Comfortably cash-flow-positive once the 1-month vacancy ends: recovers by month 3
      // (one month later than the self-managed case, since the 10% fee eats into monthly recovery).
      const deeplyPositive: BreakEvenInput = { ...templateV2, monthlyRent: 6000 };
      expect(breakEvenDownPayment(deeplyPositive).months_to_zero_cf).toBe(3);

      // A slower, mid-range recovery case (more down payment shrinks the vacancy-month hole to climb out of).
      const midRange: BreakEvenInput = { ...templateV2, downPaymentPercent: 0.5 };
      expect(breakEvenDownPayment(midRange).months_to_zero_cf).toBe(6);
    });
  });
});

describe("breakEvenMonthlyPayment", () => {
  it("Template v2: monthly_payment_for_zero_cf equals NOI / 12", () => {
    const result = breakEvenMonthlyPayment(templateV2);
    expect(result.monthly_payment_for_zero_cf).toBeCloseTo(1829.17, 2);
  });

  it("Template v2: current_monthly_payment matches mortgage.ts's Canadian payment function", () => {
    const result = breakEvenMonthlyPayment(templateV2);
    const expectedPayment = calculateMonthlyMortgagePayment(templateV2);
    expect(result.current_monthly_payment).toBeCloseTo(expectedPayment, 6);
    expect(result.current_monthly_payment).toBeCloseTo(2215.85, 2);
  });

  it("monthly_shortfall equals current_monthly_payment - monthly_payment_for_zero_cf", () => {
    const result = breakEvenMonthlyPayment(templateV2);
    expect(result.monthly_shortfall).toBeCloseTo(result.current_monthly_payment - result.monthly_payment_for_zero_cf, 6);
  });

  it("annual_shortfall equals monthly_shortfall * 12", () => {
    const result = breakEvenMonthlyPayment(templateV2);
    expect(result.annual_shortfall).toBeCloseTo(result.monthly_shortfall * 12, 6);
  });

  it("annual_shortfall is the negative of annual cash flow at the current down payment", () => {
    const result = breakEvenMonthlyPayment(templateV2);
    expect(result.annual_shortfall).toBeCloseTo(-calculateAnnualCashFlow(templateV2), 6);
  });

  it("positive CF scenario: current payment is below what NOI could support, so shortfall is negative", () => {
    const deeplyPositive: BreakEvenInput = { ...templateV2, monthlyRent: 6000 };
    const result = breakEvenMonthlyPayment(deeplyPositive);

    expect(result.current_monthly_payment).toBeLessThan(result.monthly_payment_for_zero_cf);
    expect(result.monthly_shortfall).toBeLessThan(0);
    expect(result.annual_shortfall).toBeCloseTo(-calculateAnnualCashFlow(deeplyPositive), 6);
  });

  it("US property: current_monthly_payment matches mortgage.ts's US payment function, NOI-based target unchanged", () => {
    const usInput: BreakEvenInput = { ...templateV2, country: "US", annualInterestRate: 0.065, amortizationYears: 30 };
    const result = breakEvenMonthlyPayment(usInput);
    const canadaResult = breakEvenMonthlyPayment(templateV2);

    expect(result.current_monthly_payment).toBeCloseTo(calculateMonthlyUSMortgagePayment(usInput), 6);
    // NOI doesn't depend on country/rate, so the target payment is identical to the Canadian case.
    expect(result.monthly_payment_for_zero_cf).toBeCloseTo(canadaResult.monthly_payment_for_zero_cf, 6);
  });
});

describe("calculateBreakEven", () => {
  it('mode="down_payment" returns the same shape/values as breakEvenDownPayment()', () => {
    const result = calculateBreakEven(templateV2, "down_payment");
    expect(result).toEqual(breakEvenDownPayment(templateV2));
    expect(result).toHaveProperty("down_pct_for_zero_cf");
    expect(result).not.toHaveProperty("monthly_payment_for_zero_cf");
  });

  it('mode="monthly_payment" returns the same shape/values as breakEvenMonthlyPayment()', () => {
    const result = calculateBreakEven(templateV2, "monthly_payment");
    expect(result).toEqual(breakEvenMonthlyPayment(templateV2));
    expect(result).toHaveProperty("monthly_payment_for_zero_cf");
    expect(result).not.toHaveProperty("down_pct_for_zero_cf");
  });

  it("defaults to down_payment mode when no mode argument is passed", () => {
    const result = calculateBreakEven(templateV2);
    expect(result).toEqual(breakEvenDownPayment(templateV2));
  });
});
