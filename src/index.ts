// InvestScape Calculation Engine - Complete Public API
// All 27 engines (E1-E28) + supporting types

// ============================================================================
// E1-E5: Core Engines (Mortgage, Amortization, Cash Flow, Exit, Returns)
// ============================================================================

export {
  calculateMonthlyMortgagePayment,
  calculateMonthlyUSMortgagePayment,
  semiAnnualToMonthlyRate,
  monthlyCompoundingRate,
  type MortgageInput,
} from "./mortgage";

export {
  amortizationSchedule,
  remainingBalance,
  trancheAmortizationSchedule,
  type MortgageCountry,
  type AmortizationRow,
  type AmortizingTranche,
  type TrancheAmortizationRow,
} from "./amortization";

export {
  projectCashFlows,
  type FlatDebtServiceInput,
  type RealDebtServiceInput,
  type CashFlowProjectionInput,
  type YearlyCashFlow,
} from "./cashflow";

export {
  calculateSalePrice,
  calculateExitProceeds,
  type SalePriceInput,
  type ExitProceedsInput,
  type ExitProceedsResult,
} from "./exit";

export {
  calculateIRR,
  calculateMIRR,
  calculateEquityMultiple,
  buildInvestmentCashFlowSeries,
} from "./returns";

// ============================================================================
// E6-E11: Qualifying & Portfolio (GDS/TDS, CMHC, Capital Stack, DSCR, Portfolio)
// ============================================================================

export {
  qualifyForMortgage,
  calculateStressTestRate,
  type StressTestQualifyingInput,
  type StressTestQualifyingResult,
} from "./qualifying";

export {
  calculateCMHCPremium,
  type CMHCPremiumInput,
} from "./cmhc";

export {
  calculateCapitalStack,
  type Tranche,
  type TrancheType,
  type TrancheResult,
  type CapitalStackResult,
} from "./capitalstack";

export {
  calculateNOI,
  calculateDSCR,
  evaluateDSCR,
  type NOIInput,
  type DSCRInput,
  type DSCREvaluationInput,
  type DSCREvaluationResult,
} from "./dscr";

export {
  rollupPortfolio,
  type PropertyPosition,
  type PortfolioRollup,
} from "./portfolio";

// ============================================================================
// E12-E24: Advanced Engines (PTT, Break-Even, Appreciation, Refinance, etc.)
// ============================================================================

export {
  calculateBCPTT,
  calculateUSPTT,
  calculatePTT,
  type PTTInput,
  type PTTResult,
} from "./ptt";

export {
  calculateBreakEven,
  type BreakEvenInput,
  type BreakEvenResult,
} from "./break-even";

export {
  calculateAppreciation,
  type AppreciationInput,
  type AppreciationResult,
} from "./appreciation";

export {
  calculateRefinance,
  type RefinanceInput,
  type RefinanceResult,
} from "./refinance";

export {
  calculateScenarioComparison,
  type ScenarioInput,
  type ScenarioComparisonResult,
} from "./scenario";

export {
  calculateBRRRR,
  type BRRRRInput,
  type BRRRRResult,
} from "./brrrr";

export {
  calculateHoldingPeriodSensitivity,
  type HoldingPeriodSensitivityInput,
  type HoldingPeriodSensitivityResult,
} from "./holding-period-sensitivity";

export {
  calculateTaxOptimization,
  type TaxOptimizationInput,
  type TaxOptimizationResult,
} from "./tax-optimization";

export {
  calculateDataProvenance,
  type DataProvenanceInput,
  type DataProvenanceResult,
} from "./data-provenance";

export {
  calculateFXConversion,
  type FXConversionInput,
  type FXConversionResult,
} from "./fx-conversion";

export {
  calculateRentalWaterfall,
  type RentalWaterfallInput,
  type RentalWaterfallResult,
} from "./rental-waterfall";

// ============================================================================
// E25-E28: Final Engines (Property Tax, OpEx, Insurance, Lender Scorecard)
// ============================================================================

export {
  calculatePropertyTax,
  type PropertyTaxInput,
  type PropertyTaxResult,
} from "./property-tax";

export {
  calculateOpExBenchmark,
  type OpExBenchmarkInput,
  type OpExBenchmarkResult,
} from "./opex-benchmark";

export {
  calculateInsuranceEstimation,
  type InsuranceEstimationInput,
  type InsuranceEstimationResult,
} from "./insurance-estimation";

export {
  calculateLenderScorecard,
  type LenderScorecardInput,
  type LenderScorecardResult,
} from "./lender-scorecard";

// ============================================================================
// UI Helpers (Display & Chart Data)
// ============================================================================

export {
  generateAmortizationDisplay,
  type AmortizationDisplayInput,
  type AmortizationDisplayResult,
} from "./amortization-display";

export {
  generateChartData,
  type ChartDataInput,
  type ChartData,
} from "./chart-data";
