export interface NOIInput {
  grossAnnualRent: number;
  vacancyRatePercent: number;
  annualOperatingExpenses: number;
}

export function calculateNOI(input: NOIInput): number {
  const { grossAnnualRent, vacancyRatePercent, annualOperatingExpenses } = input;

  const vacancyAllowance = grossAnnualRent * vacancyRatePercent;
  return grossAnnualRent - vacancyAllowance - annualOperatingExpenses;
}

export interface DSCRInput {
  netOperatingIncome: number;
  annualDebtService: number;
}

export function calculateDSCR(input: DSCRInput): number {
  const { netOperatingIncome, annualDebtService } = input;
  return netOperatingIncome / annualDebtService;
}

const MINIMUM_DSCR = 1.2;

export interface DSCREvaluationInput extends NOIInput {
  annualDebtService: number;
}

export interface DSCREvaluationResult {
  netOperatingIncome: number;
  dscr: number;
  meetsLenderMinimum: boolean;
}

/**
 * Lenders typically require DSCR >= 1.20 so NOI covers debt service with a
 * cushion; below that the property's own income isn't enough to safely
 * support the loan.
 */
export function evaluateDSCR(input: DSCREvaluationInput): DSCREvaluationResult {
  const { grossAnnualRent, vacancyRatePercent, annualOperatingExpenses, annualDebtService } = input;

  const netOperatingIncome = calculateNOI({ grossAnnualRent, vacancyRatePercent, annualOperatingExpenses });
  const dscr = calculateDSCR({ netOperatingIncome, annualDebtService });

  return {
    netOperatingIncome,
    dscr,
    meetsLenderMinimum: dscr >= MINIMUM_DSCR,
  };
}
