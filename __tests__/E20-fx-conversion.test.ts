import { calculateFXConversion } from "../src/E20-fx-conversion";
import { FXConversionInput, DealMetrics } from "../src/types";
import { calculateIRR } from "../src/E5-returns";

// equityInvested is solved (not guessed) so that the reconstructed series
// [-equityInvested, annualCashFlow × holdPeriodYears, +projectedEquity in
// the final year] produces exactly the stated 10% dealMetrics.irr at zero
// rate divergence — computed independently before writing any assertions
// below, not read off the function under test.
const usdDealMetrics: DealMetrics = {
  purchasePrice: 300000,
  annualCashFlow: 20000,
  projectedEquity: 150000,
  irr: 0.1,
  holdPeriodYears: 5,
  equityInvested: 168953.93384704227,
};

const cadDealMetrics: DealMetrics = {
  purchasePrice: 550000,
  annualCashFlow: 15000,
  projectedEquity: 300000,
  irr: 0.1,
  holdPeriodYears: 5,
  equityInvested: 243138.19845887332,
};

describe("calculateFXConversion", () => {
  describe("1. same currency (CAD/CAD)", () => {
    const input: FXConversionInput = {
      dealMetrics: cadDealMetrics,
      dealCurrency: "CAD",
      investorCurrency: "CAD",
      fxRate: 1.36, // deliberately a "wrong"/irrelevant value — should be normalized away
      fxRateSource: "user_input",
    };
    const result = calculateFXConversion(input);

    it("fxRate is normalized to 1.0, regardless of the input value", () => {
      expect(result.fxRate).toBe(1);
    });

    it("dealMetricsInDealCurrency and dealMetricsInInvestorCurrency are identical (no conversion)", () => {
      expect(result.dealMetricsInInvestorCurrency).toEqual(result.dealMetricsInDealCurrency);
    });

    it("IRR is unchanged", () => {
      expect(result.dealMetricsInInvestorCurrency.irr).toBe(0.1);
    });

    it("fxSensitivity shows zero movement — no FX exposure when currencies match", () => {
      expect(result.fxSensitivity.irrAt_plus5pct_rate).toBe(result.fxSensitivity.irrAt_minus5pct_rate);
      expect(result.fxSensitivity.irrAt_plus5pct_rate).toBeCloseTo(0.1, 6);
      expect(result.fxSensitivity.rateIfIRRTarget5percent).toBe(1);
      expect(result.fxSensitivity.rateIfIRRTarget10percent).toBe(1);
    });
  });

  describe("2. USD to CAD conversion (1.36 rate)", () => {
    const input: FXConversionInput = {
      dealMetrics: usdDealMetrics,
      dealCurrency: "USD",
      investorCurrency: "CAD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("conversion math is exact: $408K CAD purchase, $27.2K CAD cash flow, $204K CAD equity", () => {
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(408000, 2);
      expect(result.dealMetricsInInvestorCurrency.cashFlow).toBeCloseTo(27200, 2);
      expect(result.dealMetricsInInvestorCurrency.equity).toBeCloseTo(204000, 2);
    });

    it("IRR is still 10% in both the deal-currency and investor-currency views", () => {
      expect(result.dealMetricsInDealCurrency.irr).toBeCloseTo(0.1, 6);
      expect(result.dealMetricsInInvestorCurrency.irr).toBeCloseTo(0.1, 6);
    });

    it("rateIfIRRTarget10percent recovers the entry rate (1.36), since the deal's own baseline IS 10%", () => {
      // At zero entry/exit divergence, IRR = the deal's known baseline —
      // solving for "the rate that gives 10%" should land back on 1.36.
      expect(result.fxSensitivity.rateIfIRRTarget10percent).toBeCloseTo(1.3604, 3);
    });
  });

  describe("3. CAD to USD conversion (1.36 rate) — inverse direction", () => {
    const input: FXConversionInput = {
      dealMetrics: cadDealMetrics,
      dealCurrency: "CAD",
      investorCurrency: "USD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("conversion math is exact: $404.4K USD purchase (550K/1.36), $11K USD CF, $220.6K USD equity", () => {
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(404411.76, 2);
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(550000 / 1.36, 6);

      expect(result.dealMetricsInInvestorCurrency.cashFlow).toBeCloseTo(11029.41, 2);
      expect(result.dealMetricsInInvestorCurrency.cashFlow).toBeCloseTo(15000 / 1.36, 6);

      expect(result.dealMetricsInInvestorCurrency.equity).toBeCloseTo(220588.24, 2);
      expect(result.dealMetricsInInvestorCurrency.equity).toBeCloseTo(300000 / 1.36, 6);
    });

    it("this is genuinely division, not the multiply used for USD->CAD", () => {
      const wrongIfMultiplied = 550000 * 1.36;
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).not.toBeCloseTo(wrongIfMultiplied, 0);
    });
  });

  describe("4. FX sensitivity — rate increase (USD strengthens, USD deal / CAD investor)", () => {
    const input: FXConversionInput = {
      dealMetrics: usdDealMetrics,
      dealCurrency: "USD",
      investorCurrency: "CAD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("irrAt_plus5pct_rate > baseline IRR — more CAD per USD at exit is better for the CAD investor", () => {
      expect(result.fxSensitivity.irrAt_plus5pct_rate).toBeGreaterThan(usdDealMetrics.irr);
      expect(result.fxSensitivity.irrAt_plus5pct_rate).toBeCloseTo(0.11348, 4);
    });
  });

  describe("5. FX sensitivity — rate decrease (USD weakens, USD deal / CAD investor)", () => {
    const input: FXConversionInput = {
      dealMetrics: usdDealMetrics,
      dealCurrency: "USD",
      investorCurrency: "CAD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("irrAt_minus5pct_rate < baseline IRR — fewer CAD per USD at exit is worse for the CAD investor", () => {
      expect(result.fxSensitivity.irrAt_minus5pct_rate).toBeLessThan(usdDealMetrics.irr);
      expect(result.fxSensitivity.irrAt_minus5pct_rate).toBeCloseTo(0.08609, 4);
    });
  });

  describe("6. bisection search for a target IRR", () => {
    // NOTE: the task brief asked for "rateForTargetIRR_8pct" / solving for
    // 8% specifically, but FXSensitivity only exposes two target fields —
    // rateIfIRRTarget5percent and rateIfIRRTarget10percent — there is no
    // 8%-target field or arbitrary-target parameter in the public API. This
    // uses rateIfIRRTarget5percent instead (5% < the 10% baseline, same
    // "solve for a rate below baseline" shape the brief was after) and
    // verifies its round-trip directly, since that's what's actually
    // exposed. See src/fx-conversion.ts's FXSensitivity type.
    const input: FXConversionInput = {
      dealMetrics: usdDealMetrics,
      dealCurrency: "USD",
      investorCurrency: "CAD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("rateIfIRRTarget5percent is found via bisection (below the entry rate, since 5% < the 10% baseline in an increasing/multiply relationship)", () => {
      expect(result.fxSensitivity.rateIfIRRTarget5percent).toBeCloseTo(1.1254, 3);
      expect(result.fxSensitivity.rateIfIRRTarget5percent).toBeLessThan(result.fxRate);
    });

    it("applying the solved rate as the exit rate reproduces ~5% IRR (round-trip verification)", () => {
      const { equityInvested, annualCashFlow, projectedEquity, holdPeriodYears } = usdDealMetrics;
      const entryRateCAD = 1.36;
      const solvedExitRate = result.fxSensitivity.rateIfIRRTarget5percent;

      const series = [
        -(equityInvested * entryRateCAD),
        ...Array(holdPeriodYears).fill(annualCashFlow * solvedExitRate),
      ];
      series[series.length - 1] += projectedEquity * solvedExitRate;

      expect(calculateIRR(series)).toBeCloseTo(0.05, 3);
    });
  });

  describe("7. inverse direction (CAD deal / USD investor): sensitivity direction is reversed", () => {
    const input: FXConversionInput = {
      dealMetrics: cadDealMetrics,
      dealCurrency: "CAD",
      investorCurrency: "USD",
      fxRate: 1.36,
      fxRateSource: "market_current",
    };
    const result = calculateFXConversion(input);

    it("a rate increase now HURTS the investor (fewer USD per CAD), the opposite of the USD-deal/CAD-investor case", () => {
      expect(result.fxSensitivity.irrAt_plus5pct_rate).toBeLessThan(cadDealMetrics.irr);
      expect(result.fxSensitivity.irrAt_minus5pct_rate).toBeGreaterThan(cadDealMetrics.irr);
    });

    it("rateIfIRRTarget10percent still recovers the entry rate (1.36) — the baseline calibration holds regardless of direction", () => {
      expect(result.fxSensitivity.rateIfIRRTarget10percent).toBeCloseTo(1.3604, 3);
    });
  });

  describe("8. edge case: very high/low FX rates", () => {
    // NOTE: calculateFXConversion's public API takes one fxRate (the entry
    // rate) — there's no way to independently request an arbitrary "exit
    // rate" like 0.90 or 2.00 through it directly (fxSensitivity's exit
    // rates are fixed at ±5% of the entry rate, or solved internally). This
    // tests 0.90 and 2.00 as extreme ENTRY rates instead, which exercises
    // the same "does this compute without blowing up" concern.
    it("a very low rate (0.90) computes correctly with no division errors", () => {
      const input: FXConversionInput = {
        dealMetrics: usdDealMetrics,
        dealCurrency: "USD",
        investorCurrency: "CAD",
        fxRate: 0.9,
        fxRateSource: "user_input",
      };
      const result = calculateFXConversion(input);

      expect(Number.isFinite(result.dealMetricsInInvestorCurrency.purchasePrice)).toBe(true);
      expect(Number.isFinite(result.fxSensitivity.irrAt_plus5pct_rate)).toBe(true);
      expect(Number.isFinite(result.fxSensitivity.rateIfIRRTarget5percent)).toBe(true);
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(270000, 2);
    });

    it("a very high rate (2.00) computes correctly with no division errors", () => {
      const input: FXConversionInput = {
        dealMetrics: usdDealMetrics,
        dealCurrency: "USD",
        investorCurrency: "CAD",
        fxRate: 2.0,
        fxRateSource: "user_input",
      };
      const result = calculateFXConversion(input);

      expect(Number.isFinite(result.dealMetricsInInvestorCurrency.purchasePrice)).toBe(true);
      expect(Number.isFinite(result.fxSensitivity.irrAt_plus5pct_rate)).toBe(true);
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(600000, 2);
    });

    it("a division-mode edge case (CAD deal / USD investor) at an extreme rate also computes cleanly", () => {
      const input: FXConversionInput = {
        dealMetrics: cadDealMetrics,
        dealCurrency: "CAD",
        investorCurrency: "USD",
        fxRate: 0.9,
        fxRateSource: "user_input",
      };
      const result = calculateFXConversion(input);

      expect(Number.isFinite(result.dealMetricsInInvestorCurrency.purchasePrice)).toBe(true);
      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(550000 / 0.9, 2);
    });
  });

  describe("entry-locked equity: the entry outflow uses the entry rate, unaffected by exit-rate exploration", () => {
    it("purchasePrice in investor currency is exactly purchasePrice × entry fxRate, matching what feeds fxSensitivity's entry leg", () => {
      // NOTE: the task brief called this "monthlyEquityInvested
      // verification", but there's no "monthlyEquityInvested" field
      // anywhere in fx-conversion.ts — DealMetrics.equityInvested is a
      // single point-in-time entry investment, not a recurring monthly
      // figure. This verifies the actual underlying concept ("entry locked,
      // exit varies") through the public API: dealMetricsInInvestorCurrency
      // (which uses only the entry rate) doesn't depend on anything in
      // fxSensitivity (which varies the exit rate) — they're independently
      // exact regardless of what the other computes.
      const input: FXConversionInput = {
        dealMetrics: usdDealMetrics,
        dealCurrency: "USD",
        investorCurrency: "CAD",
        fxRate: 1.36,
        fxRateSource: "market_current",
      };
      const result = calculateFXConversion(input);

      expect(result.dealMetricsInInvestorCurrency.purchasePrice).toBeCloseTo(usdDealMetrics.purchasePrice * 1.36, 6);
      // Changing only equityInvested (which feeds fxSensitivity's entry leg,
      // not the plain currency-conversion fields) must NOT change
      // dealMetricsInInvestorCurrency at all — proving entry equity is
      // scoped to fxSensitivity, not the headline conversion.
      const withDifferentEquity = calculateFXConversion({
        ...input,
        dealMetrics: { ...usdDealMetrics, equityInvested: usdDealMetrics.equityInvested * 2 },
      });
      expect(withDifferentEquity.dealMetricsInInvestorCurrency).toEqual(result.dealMetricsInInvestorCurrency);
    });
  });

  describe("summary string", () => {
    it("includes both currencies, both purchase prices, the shared IRR, and both sensitivity IRRs", () => {
      const input: FXConversionInput = {
        dealMetrics: usdDealMetrics,
        dealCurrency: "USD",
        investorCurrency: "CAD",
        fxRate: 1.36,
        fxRateSource: "market_current",
      };
      const result = calculateFXConversion(input);

      expect(result.summary).toContain("In USD:");
      expect(result.summary).toContain("In CAD:");
      expect(result.summary).toContain("300000.00");
      expect(result.summary).toContain("408000.00");
      expect(result.summary).toContain("10.00% IRR");
      expect(result.summary).toContain((result.fxSensitivity.irrAt_plus5pct_rate * 100).toFixed(2));
      expect(result.summary).toContain((result.fxSensitivity.irrAt_minus5pct_rate * 100).toFixed(2));
    });

    it("same-currency case explicitly notes IRR doesn't change with conversion", () => {
      const input: FXConversionInput = {
        dealMetrics: cadDealMetrics,
        dealCurrency: "CAD",
        investorCurrency: "CAD",
        fxRate: 1.36,
        fxRateSource: "user_input",
      };
      const result = calculateFXConversion(input);
      expect(result.summary).toContain("doesn't change a ratio");
    });
  });
});
