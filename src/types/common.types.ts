// Shared types used across multiple calculation engines.

export interface MortgageInput {
  purchasePrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  amortizationYears: number;
}

/**
 * mortgage.ts has no country/compounding field on MortgageInput — Canadian
 * vs. US is selected by which payment function you call. This mirrors that:
 * an explicit parameter, not an invented field.
 */
export type MortgageCountry = "Canada" | "US";

export interface YearlyCashFlow {
  year: number;
  grossRent: number;
  vacancyAllowance: number;
  operatingExpenses: number;
  noi: number;
  /**
   * Full annual P&I payment. Doc 01 Part B defines debt_service_annual as
   * the full payment (B6 Break-Even Ratio, B10 ROE both subtract/add it
   * that way) — a real cash outflow includes principal, not just interest
   * — so this stays the full payment even when it's sourced from a real
   * amortization schedule (RealDebtServiceInput). Do not change this to
   * interest-only; that's what interestPaid is for.
   */
  debtService: number;
  /**
   * Real per-year interest/principal split from amortizationSchedule() —
   * only present for RealDebtServiceInput. undefined for the legacy flat
   * annualDebtService path, since there's no schedule to split.
   */
  interestPaid?: number;
  principalPaid?: number;
  netCashFlow: number;
}

/**
 * Everything that stays constant across scenarios — the property, its
 * financing, and its current operating numbers. Only rentGrowthRate,
 * expenseGrowthRate, appreciationRate, and exitCapRate vary per scenario
 * (see ScenarioAssumptions). Not literally spelled out in the E18 spec
 * ("standard deal object with all parameters"), so this shape is derived
 * from what the engines it wires together (cashflow.ts, appreciation.ts,
 * exit.ts, amortization.ts) actually require.
 */
export interface DealParameters {
  purchasePrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  amortizationYears: number;
  country: MortgageCountry;
  grossAnnualRent: number;
  vacancyRatePercent: number;
  annualOperatingExpenses: number;
  /** Down payment + closing costs — the actual cash invested at purchase. */
  equityInvested: number;
}
