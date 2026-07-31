import { rollupPortfolio } from "../src/portfolio";

describe("rollupPortfolio", () => {
  const properties = [
    { name: "Property A", equityInvested: 300000, irr: 0.13, annualNetCashFlow: 19000, dscr: 1.35, propertyValue: 1000000 },
    { name: "Property B", equityInvested: 200000, irr: 0.15, annualNetCashFlow: 12000, dscr: 1.15, propertyValue: 700000 },
    { name: "Property C", equityInvested: 500000, irr: 0.11, annualNetCashFlow: 30000, dscr: 1.5, propertyValue: 1300000 },
  ];

  const result = rollupPortfolio(properties);

  it("sums total equity invested across all properties", () => {
    expect(result.totalEquityInvested).toBeCloseTo(1000000, 2);
  });

  it("computes blended IRR weighted by each property's equity invested", () => {
    // 13% * 0.3 + 15% * 0.2 + 11% * 0.5 = 12.4%
    expect(result.blendedIRR).toBeCloseTo(0.124, 4);
  });

  it("sums total annual net cash flow across all properties", () => {
    expect(result.totalAnnualNetCashFlow).toBeCloseTo(61000, 2);
  });

  it("takes the DSCR floor as the weakest-covered property (Property B at 1.15)", () => {
    expect(result.portfolioDSCRFloor).toBeCloseTo(1.15, 4);
  });

  it("sums total portfolio value across all properties", () => {
    expect(result.totalPortfolioValue).toBeCloseTo(3000000, 2);
  });

  it("computes each property's concentration as a percent of total portfolio value", () => {
    const [a, b, c] = result.concentrationRisk;

    expect(a.percentOfPortfolio).toBeCloseTo(0.3333, 4);
    expect(b.percentOfPortfolio).toBeCloseTo(0.2333, 4);
    expect(c.percentOfPortfolio).toBeCloseTo(0.4333, 4);

    const total = a.percentOfPortfolio + b.percentOfPortfolio + c.percentOfPortfolio;
    expect(total).toBeCloseTo(1, 4);
  });
});
