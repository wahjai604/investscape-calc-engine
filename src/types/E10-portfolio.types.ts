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
