export interface PropertyPosition {
  name: string;
  equityInvested: number;
  irr: number;
  annualNetCashFlow: number;
  dscr: number;
  propertyValue: number;
}

export interface ConcentrationRisk {
  name: string;
  propertyValue: number;
  percentOfPortfolio: number;
}

export interface PortfolioRollup {
  totalEquityInvested: number;
  blendedIRR: number;
  totalAnnualNetCashFlow: number;
  portfolioDSCRFloor: number;
  totalPortfolioValue: number;
  concentrationRisk: ConcentrationRisk[];
}

/**
 * Blended IRR is a weighted average of each property's own IRR, weighted by
 * its share of total equity invested (not a re-derived IRR off pooled cash
 * flows). The DSCR floor is the single weakest-covered property in the
 * portfolio, since that's the one most likely to trip a lender covenant.
 */
export function rollupPortfolio(properties: PropertyPosition[]): PortfolioRollup {
  const totalEquityInvested = properties.reduce((sum, p) => sum + p.equityInvested, 0);
  const totalAnnualNetCashFlow = properties.reduce((sum, p) => sum + p.annualNetCashFlow, 0);
  const totalPortfolioValue = properties.reduce((sum, p) => sum + p.propertyValue, 0);

  const blendedIRR = properties.reduce(
    (sum, p) => sum + p.irr * (p.equityInvested / totalEquityInvested),
    0
  );

  const portfolioDSCRFloor = Math.min(...properties.map((p) => p.dscr));

  const concentrationRisk: ConcentrationRisk[] = properties.map((p) => ({
    name: p.name,
    propertyValue: p.propertyValue,
    percentOfPortfolio: p.propertyValue / totalPortfolioValue,
  }));

  return {
    totalEquityInvested,
    blendedIRR,
    totalAnnualNetCashFlow,
    portfolioDSCRFloor,
    totalPortfolioValue,
    concentrationRisk,
  };
}
