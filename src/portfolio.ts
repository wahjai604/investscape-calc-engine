import { calculateIRR } from "./returns";

export interface PropertyPosition {
  name: string;
  equityInvested: number;
  cashFlowSeries: number[];
  annualNetCashFlow: number;
  dscr: number;
  propertyValue: number;
}

export interface PropertyIRRDetail {
  name: string;
  individualIRR: number;
}

export interface ConcentrationRisk {
  name: string;
  propertyValue: number;
  percentOfPortfolio: number;
}

export interface PortfolioRollup {
  totalEquityInvested: number;
  pooledPortfolioIRR: number;
  propertyIRRs: PropertyIRRDetail[];
  totalAnnualNetCashFlow: number;
  portfolioDSCRFloor: number;
  totalPortfolioValue: number;
  concentrationRisk: ConcentrationRisk[];
}

/**
 * IRR is not linear in cash flow timing, so a weighted average of each
 * property's own IRR is not the IRR of the combined investment. The correct
 * portfolio IRR pools every property's cash flow period-by-period into one
 * series (year 0 with year 0, year 1 with year 1, ...) and runs IRR once on
 * that pooled series. Properties with shorter hold periods contribute zero
 * cash flow in the periods beyond their own hold, since they've already
 * exited and returned capital by then.
 */
export function poolPortfolioCashFlows(properties: PropertyPosition[]): number[] {
  const periodCount = Math.max(...properties.map((p) => p.cashFlowSeries.length));
  const pooled = new Array(periodCount).fill(0);

  for (const property of properties) {
    property.cashFlowSeries.forEach((cashFlow, period) => {
      pooled[period] += cashFlow;
    });
  }

  return pooled;
}

export function rollupPortfolio(properties: PropertyPosition[], irrGuess = 0.1): PortfolioRollup {
  const totalEquityInvested = properties.reduce((sum, p) => sum + p.equityInvested, 0);
  const totalAnnualNetCashFlow = properties.reduce((sum, p) => sum + p.annualNetCashFlow, 0);
  const totalPortfolioValue = properties.reduce((sum, p) => sum + p.propertyValue, 0);

  const pooledCashFlows = poolPortfolioCashFlows(properties);
  const pooledPortfolioIRR = calculateIRR(pooledCashFlows, irrGuess);

  // Kept for display purposes only (e.g. showing each property's own IRR
  // next to the portfolio's true pooled IRR) — not used in any aggregate math.
  const propertyIRRs: PropertyIRRDetail[] = properties.map((p) => ({
    name: p.name,
    individualIRR: calculateIRR(p.cashFlowSeries, irrGuess),
  }));

  const portfolioDSCRFloor = Math.min(...properties.map((p) => p.dscr));

  const concentrationRisk: ConcentrationRisk[] = properties.map((p) => ({
    name: p.name,
    propertyValue: p.propertyValue,
    percentOfPortfolio: p.propertyValue / totalPortfolioValue,
  }));

  return {
    totalEquityInvested,
    pooledPortfolioIRR,
    propertyIRRs,
    totalAnnualNetCashFlow,
    portfolioDSCRFloor,
    totalPortfolioValue,
    concentrationRisk,
  };
}
