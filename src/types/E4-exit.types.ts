import { MortgageInput, MortgageCountry, YearlyCashFlow } from "./common.types";

/**
 * Standalone, independently-testable sale-price calculation. Method is an
 * explicit discriminator (not a boolean) so there's no ambiguous default.
 */
export type SalePriceInput =
  | { method: "flat_growth"; originalPurchasePrice: number; appreciationRate: number; holdPeriodYears: number }
  | { method: "cap_rate"; finalYearNOI: number; exitCapRate: number };

interface ExitProceedsInputBase {
  sellingCostsRate: number;
  loan: MortgageInput;
  country: MortgageCountry;
  holdPeriodYears: number;
  equityInvested: number;
  /** E9's projectCashFlows() output, passed in already-built — not reconstructed here. */
  projection: YearlyCashFlow[];
}

export type ExitProceedsInput =
  | (ExitProceedsInputBase & { method: "flat_growth"; originalPurchasePrice: number; appreciationRate: number })
  | (ExitProceedsInputBase & { method: "cap_rate"; exitCapRate: number });

export interface ExitProceedsResult {
  salePrice: number;
  sellingCosts: number;
  remainingLoanBalance: number;
  netSaleProceeds: number;
  fullCycleIRR: number;
}
