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
