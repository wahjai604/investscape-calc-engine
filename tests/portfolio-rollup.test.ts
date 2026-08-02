import { projectCashFlows } from "../src/cashflow";
import { buildInvestmentCashFlowSeries } from "../src/returns";
import { rollupPortfolio, PropertyPosition } from "../src/portfolio";
import {
  checkGating,
  findMalformedField,
  findBlockedProperties,
  buildSuccessBody,
  handlePortfolioRollup,
  authorizeRequest,
} from "../supabase/functions/portfolio-rollup/handler";
import { OwnedPropertyRow } from "../supabase/functions/portfolio-rollup/types";

// Same three-property fixture as tests/portfolio.test.ts (5yr / 3yr / 4yr
// holds), reused here to prove the HTTP response layer doesn't transform or
// corrupt rollupPortfolio()'s output on the way out.
function buildGoldenProperties(): PropertyPosition[] {
  const aCashFlows = projectCashFlows({
    holdPeriodYears: 5,
    grossAnnualRent: 120000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 40000,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.02,
    annualDebtService: 55000,
  });
  const aSeries = buildInvestmentCashFlowSeries(300000, aCashFlows, 400000);

  const bCashFlows = projectCashFlows({
    holdPeriodYears: 3,
    grossAnnualRent: 80000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 25000,
    rentGrowthRate: 0.02,
    expenseGrowthRate: 0.03,
    annualDebtService: 32000,
  });
  const bSeries = buildInvestmentCashFlowSeries(150000, bCashFlows, 220000);

  const cCashFlows = projectCashFlows({
    holdPeriodYears: 4,
    grossAnnualRent: 100000,
    vacancyRatePercent: 0.06,
    annualOperatingExpenses: 35000,
    rentGrowthRate: 0.025,
    expenseGrowthRate: 0.02,
    annualDebtService: 40000,
  });
  const cSeries = buildInvestmentCashFlowSeries(250000, cCashFlows, 300000);

  return [
    {
      name: "Property A",
      equityInvested: 300000,
      cashFlowSeries: aSeries,
      annualNetCashFlow: aCashFlows[0].netCashFlow,
      dscr: 1.35,
      propertyValue: 1000000,
    },
    {
      name: "Property B",
      equityInvested: 150000,
      cashFlowSeries: bSeries,
      annualNetCashFlow: bCashFlows[0].netCashFlow,
      dscr: 1.15,
      propertyValue: 600000,
    },
    {
      name: "Property C",
      equityInvested: 250000,
      cashFlowSeries: cSeries,
      annualNetCashFlow: cCashFlows[0].netCashFlow,
      dscr: 1.5,
      propertyValue: 800000,
    },
  ];
}

function buildOwnedRow(overrides: Partial<OwnedPropertyRow> = {}, dealOverrides: Partial<OwnedPropertyRow["deal"]> = {}): OwnedPropertyRow {
  return {
    id: "prop-1",
    address: "142 Maple Grove Ave",
    acquisition_date: "2024-01-15",
    hold_period_assumption_years: 5,
    appreciation_assumption_pct_annual: 0.03,
    deal: {
      id: "deal-1",
      purchase_price: 1000000,
      initial_cash_invested: 300000,
      cash_flow_annual: 19000,
      dscr: 1.35,
      monthly_payment: 4583.33,
      ...dealOverrides,
    },
    ...overrides,
  };
}

describe("portfolio-rollup Edge Function handler", () => {
  describe("HTTP response layer fidelity (does not transform/corrupt rollupPortfolio's output)", () => {
    it("buildSuccessBody's pooledPortfolioIRR matches calling rollupPortfolio() directly with the same data", () => {
      const properties = buildGoldenProperties();

      const direct = rollupPortfolio(properties);
      const httpBody = buildSuccessBody(properties);

      expect(httpBody.status).toBe("ok");
      expect(httpBody.pooledPortfolioIRR).toBeCloseTo(direct.pooledPortfolioIRR, 10);
      expect(httpBody.pooledPortfolioIRR).toBeCloseTo(0.14997, 4);
      expect(httpBody.totalEquityInvested).toBe(direct.totalEquityInvested);
      expect(httpBody.portfolioDSCRFloor).toBe(direct.portfolioDSCRFloor);
      expect(httpBody.totalPortfolioValue).toBe(direct.totalPortfolioValue);
      expect(httpBody.concentrationRisk).toEqual(direct.concentrationRisk);
      expect(httpBody.propertyIRRs).toEqual(direct.propertyIRRs);
    });
  });

  describe("gating (Prompt 5g rule, Doc 51)", () => {
    it("gates the whole portfolio when one of three properties is missing hold_period_assumption_years", () => {
      const rows = [
        buildOwnedRow({ id: "prop-1", address: "142 Maple Grove Ave" }),
        buildOwnedRow({
          id: "prop-2",
          address: "88 Birchwood Cres",
          hold_period_assumption_years: null,
        }),
        buildOwnedRow({ id: "prop-3", address: "12 Cedar Lane" }),
      ];

      const result = handlePortfolioRollup(rows);

      expect(result.httpStatus).toBe(200);
      expect(result.body.status).toBe("gated");
      if (result.body.status === "gated") {
        expect(result.body.missingProperties).toHaveLength(1);
        expect(result.body.missingProperties[0]).toEqual({
          propertyId: "prop-2",
          propertyName: "88 Birchwood Cres",
          missing: ["hold_period_assumption_years"],
        });
      }
    });

    it("does not silently exclude the incomplete property and return a number for the rest", () => {
      const rows = [
        buildOwnedRow({ id: "prop-1" }),
        buildOwnedRow({ id: "prop-2", appreciation_assumption_pct_annual: null }),
      ];

      const result = handlePortfolioRollup(rows);

      expect(result.body.status).toBe("gated");
      expect((result.body as any).pooledPortfolioIRR).toBeUndefined();
    });

    it("checkGating flags both fields when both are missing", () => {
      const rows = [
        buildOwnedRow({
          id: "prop-4",
          address: "9 Elm St",
          hold_period_assumption_years: null,
          appreciation_assumption_pct_annual: null,
        }),
      ];

      expect(checkGating(rows)).toEqual([
        {
          propertyId: "prop-4",
          propertyName: "9 Elm St",
          missing: ["hold_period_assumption_years", "appreciation_assumption_pct_annual"],
        },
      ]);
    });
  });

  describe("malformed per-property data", () => {
    it("names the property and field instead of a generic failure", () => {
      const rows = [buildOwnedRow({ id: "prop-5", address: "5 Oak Row" }, { dscr: null })];

      const found = findMalformedField(rows);
      expect(found).toEqual({
        propertyId: "prop-5",
        propertyName: "5 Oak Row",
        field: "deal_metrics.dscr",
      });

      const result = handlePortfolioRollup(rows);
      expect(result.httpStatus).toBe(422);
      expect(result.body).toMatchObject({
        status: "error",
        error: "malformed_property_data",
        propertyId: "prop-5",
        field: "deal_metrics.dscr",
      });
    });
  });

  describe("cashFlowSeries construction gap (Doc 54 E10 + missing growth-rate schema fields)", () => {
    it("blocks with a named reason instead of inventing exit value / growth rate assumptions", () => {
      const rows = [buildOwnedRow({ id: "prop-6", address: "6 Pine Ct" })];

      expect(findBlockedProperties(rows)).toEqual([
        { propertyId: "prop-6", propertyName: "6 Pine Ct", missingFields: ["rentGrowthRate", "expenseGrowthRate", "exitValue"] },
      ]);

      const result = handlePortfolioRollup(rows);
      expect(result.httpStatus).toBe(501);
      expect(result.body).toMatchObject({ status: "blocked", error: "cash_flow_construction_blocked" });
    });
  });

  describe("no owned properties", () => {
    it("returns an explicit empty state rather than calling rollupPortfolio with an empty array", () => {
      const result = handlePortfolioRollup([]);
      expect(result.httpStatus).toBe(200);
      expect(result.body).toEqual({ status: "empty", message: "No owned properties found for this account." });
    });
  });

  describe("authentication", () => {
    it("rejects a request with no Authorization header", async () => {
      const verifyJwt = jest.fn();
      const result = await authorizeRequest(null, verifyJwt);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(401);
      }
      expect(verifyJwt).not.toHaveBeenCalled();
    });

    it("rejects a request with an invalid/expired JWT", async () => {
      const verifyJwt = jest.fn().mockResolvedValue(null);
      const result = await authorizeRequest("Bearer bad-token", verifyJwt);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(401);
      }
    });

    it("never accepts a user_id from the request — userId comes only from the verified JWT", async () => {
      const verifyJwt = jest.fn().mockResolvedValue({ id: "real-authenticated-user-id" });
      const result = await authorizeRequest("Bearer good-token", verifyJwt);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.userId).toBe("real-authenticated-user-id");
      }
      expect(verifyJwt).toHaveBeenCalledWith("good-token");
    });
  });
});
