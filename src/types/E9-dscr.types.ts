export interface NOIInput {
  grossAnnualRent: number;
  vacancyRatePercent: number;
  annualOperatingExpenses: number;
}

export interface DSCRInput {
  netOperatingIncome: number;
  annualDebtService: number;
}

export interface DSCREvaluationInput extends NOIInput {
  annualDebtService: number;
}

export interface DSCREvaluationResult {
  netOperatingIncome: number;
  dscr: number;
  meetsLenderMinimum: boolean;
}
