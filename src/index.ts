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

// InvestScape Calculation Engine - Complete Public API
// All 28 engines (E1-E28) + supporting types

// ============================================================================
// E1-E5: Core Engines (Mortgage, Amortization, Cash Flow, Exit, Returns)
// ============================================================================

export {
  calculateMonthlyMortgagePayment,
  calculateMonthlyUSMortgagePayment,
  semiAnnualToMonthlyRate,
  monthlyCompoundingRate,
} from "./E1-mortgage";

export {
  amortizationSchedule,
  remainingBalance,
  trancheAmortizationSchedule,
} from "./E2-amortization";

export { projectCashFlows } from "./E3-cashflow";

export { calculateExitProceeds } from "./E4-exit";

export {
  calculateIRR,
  calculateMIRR,
  calculateEquityMultiple,
  buildInvestmentCashFlowSeries,
} from "./E5-returns";

// ============================================================================
// E6-E10: Qualifying & Portfolio (GDS/TDS, CMHC, Capital Stack, DSCR, Portfolio)
// ============================================================================

export { qualifyForMortgage, calculateStressTestRate } from "./E6-qualifying";

export { calculateCMHCPremium } from "./E7-cmhc";

export { calculateCapitalStack } from "./E8-capitalstack";

export { calculateNOI, calculateDSCR, evaluateDSCR } from "./E9-dscr";

export { rollupPortfolio, poolPortfolioCashFlows } from "./E10-portfolio";

// ============================================================================
// E11-E21: Advanced Engines (PTT, Break-Even, Appreciation, Refinance, etc.)
// ============================================================================

export { calculateBCPTT, calculateUSPTT, calculatePTT } from "./E11-ptt";

export { calculateBreakEven } from "./E12-break-even";

export { calculateAppreciation } from "./E13-appreciation";

export { calculateRefinance } from "./E14-refinance";

export { calculateScenarioComparison } from "./E15-scenario";

export { calculateBRRRR } from "./E16-brrrr";

export { calculateHoldingPeriodSensitivity } from "./E17-holding-period-sensitivity";

export { calculateTaxOptimization } from "./E18-tax-optimization";

export { calculateDataProvenance } from "./E19-data-provenance";

export { calculateFXConversion } from "./E20-fx-conversion";

export { calculateRentalWaterfall } from "./E21-rental-waterfall";

// ============================================================================
// E22-E25: Final Engines (Property Tax, OpEx, Insurance, Lender Scorecard)
// ============================================================================

export { calculatePropertyTax } from "./E22-property-tax";

export { calculateOpExBenchmark } from "./E23-opex-benchmark";

export { calculateInsuranceEstimation } from "./E24-insurance-estimation";

export { calculateLenderScorecard } from "./E25-lender-scorecard";

// ============================================================================
// E26-E27: UI Helpers (Display & Chart Data)
// ============================================================================

export { generateAmortizationDisplay } from "./E26-amortization-display";

export { generateChartData } from "./E27-chart-data";

// ============================================================================
// E28: Sales Price Appreciation
// ============================================================================

export { calculateSalePrice } from "./E28-Sales-Appreciation";

// ============================================================================
// E71-E72: Syndication Waterfall (LP/GP Capital Structure)
// ============================================================================

export { calculateSyndicationWaterfall } from "./E71-syndication-waterfall";

export {
  calculateGrossedUpCatchUpTarget,
  calculateGPCatchUpForPeriod,
} from "./E72-gp-catchup";

// ============================================================================
// Types
// ============================================================================

export * from "./types";

// ============================================================================
// Utils
// ============================================================================

export * from "./utils";
