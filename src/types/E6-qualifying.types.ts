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
