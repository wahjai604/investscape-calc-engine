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

/**
 * "automated" models a DU/LPA-equivalent "Approve/Eligible" finding;
 * "manual" is manually underwritten. Explicit input — never inferred from
 * other fields, since a caller's own lender relationship determines this,
 * not anything computable from the loan numbers.
 */
export type USUnderwritingPath = "manual" | "automated";

export type USDTITierLabel = "manual_baseline" | "manual_compensating" | "automated";

export interface USQualifyingInput {
  purchasePrice: number;
  downPaymentPercent: number;
  contractRate: number;
  amortizationYears: number;
  annualPropertyTax: number;
  annualHomeownersInsurance: number;
  /** 100% counted toward DTI — unlike Canadian GDS's 50% condo-fee treatment (see E6-qualifying.ts). */
  monthlyHOADues?: number;
  otherMonthlyDebtPayments: number;
  grossAnnualIncome: number;

  underwritingPath: USUnderwritingPath;
  creditScore: number;
  reserveMonths: number;

  /** Determines which conforming loan limit applies (US_CONFORMING_LOAN_LIMIT_STANDARD vs. _HIGH_COST). */
  isHighCostArea: boolean;

  /**
   * Optional monthly PMI/FHA-MIP amount (from E75/E74) to fold into the
   * back-end DTI numerator for a fully accurate ratio. E73 does not call
   * E74/E75 internally — each engine stays independently testable — so
   * omitting this computes DTI without mortgage insurance, which
   * understates the true ratio whenever MI actually applies.
   */
  monthlyMortgageInsurance?: number;
}

export interface USDTITierResult {
  underwritingPath: USUnderwritingPath;
  compensatingFactorMet: boolean;
  maxDTIRatio: number;
  tierLabel: USDTITierLabel;
}

export interface USConformingLoanLimitCheck {
  loanAmount: number;
  applicableLimit: number;
  exceedsConformingLimit: boolean;
}

export interface USQualifyingResult {
  dtiTier: USDTITierResult;
  monthlyMortgagePayment: number;
  /** PITIA (+ MI if monthlyMortgageInsurance was supplied) + other debt, over gross monthly income. Conventional US lending has no separate front-end ratio on the main product — see docs/US-QUALIFIER-SOURCES.md. */
  backEndDTIRatio: number;
  dtiPass: boolean;
  qualifies: boolean;
  conformingLoanLimitCheck: USConformingLoanLimitCheck;
  issues: string[];
}
