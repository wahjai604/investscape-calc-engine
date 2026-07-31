import { calculateMonthlyMortgagePayment } from "./mortgage";

export interface StressTestQualifyingInput {
  purchasePrice: number;
  downPaymentPercent: number;
  contractRate: number;
  amortizationYears: number;
  annualPropertyTax: number;
  annualHeatingCost: number;
  monthlyCondoFees?: number;
  otherMonthlyDebtPayments: number;
  grossAnnualIncome: number;
}

export interface StressTestQualifyingResult {
  qualifyingRate: number;
  monthlyMortgagePayment: number;
  gdsRatio: number;
  tdsRatio: number;
  gdsPass: boolean;
  tdsPass: boolean;
  qualifies: boolean;
}

const MINIMUM_QUALIFYING_RATE = 0.0525;
const STRESS_TEST_BUFFER = 0.02;
const GDS_MAX_RATIO = 0.39;
const TDS_MAX_RATIO = 0.44;

/**
 * OSFI/FCAC mortgage stress test: borrowers must qualify at the greater of
 * the 5.25% floor or their contract rate plus a 2% buffer, not at the
 * contract rate itself.
 */
export function calculateStressTestRate(contractRate: number): number {
  return Math.max(MINIMUM_QUALIFYING_RATE, contractRate + STRESS_TEST_BUFFER);
}

export function qualifyForMortgage(input: StressTestQualifyingInput): StressTestQualifyingResult {
  const {
    purchasePrice,
    downPaymentPercent,
    contractRate,
    amortizationYears,
    annualPropertyTax,
    annualHeatingCost,
    monthlyCondoFees = 0,
    otherMonthlyDebtPayments,
    grossAnnualIncome,
  } = input;

  const qualifyingRate = calculateStressTestRate(contractRate);
  const monthlyMortgagePayment = calculateMonthlyMortgagePayment({
    purchasePrice,
    downPaymentPercent,
    annualInterestRate: qualifyingRate,
    amortizationYears,
  });

  const monthlyGrossIncome = grossAnnualIncome / 12;

  // CMHC convention: only 50% of condo fees count toward GDS/TDS.
  const gdsNumerator =
    monthlyMortgagePayment + annualPropertyTax / 12 + annualHeatingCost / 12 + monthlyCondoFees * 0.5;
  const tdsNumerator = gdsNumerator + otherMonthlyDebtPayments;

  const gdsRatio = gdsNumerator / monthlyGrossIncome;
  const tdsRatio = tdsNumerator / monthlyGrossIncome;

  const gdsPass = gdsRatio <= GDS_MAX_RATIO;
  const tdsPass = tdsRatio <= TDS_MAX_RATIO;

  return {
    qualifyingRate,
    monthlyMortgagePayment,
    gdsRatio,
    tdsRatio,
    gdsPass,
    tdsPass,
    qualifies: gdsPass && tdsPass,
  };
}
