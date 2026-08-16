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

import { calculateMonthlyUSMortgagePayment } from "./E1-mortgage";
import {
  USConformingLoanLimitCheck,
  USDTITierResult,
  USQualifyingInput,
  USQualifyingResult,
} from "./types";
import {
  US_CONFORMING_LOAN_LIMIT_HIGH_COST,
  US_CONFORMING_LOAN_LIMIT_STANDARD,
  US_DTI_AUTOMATED_MAX,
  US_DTI_COMPENSATING_MAX,
  US_DTI_COMPENSATING_MAX_LTV,
  US_DTI_COMPENSATING_MIN_CREDIT_SCORE,
  US_DTI_COMPENSATING_MIN_RESERVE_MONTHS,
  US_DTI_MANUAL_MAX,
} from "./utils/constants";

/**
 * There is no US equivalent of Canada's B-20 rate-based stress test (see
 * E6-qualifying.ts's calculateStressTestRate) — that was replaced in 2021
 * by a lender-side APR-vs-APOR safe harbour that isn't a borrower-facing
 * affordability number at all. What the US has instead is a back-end DTI
 * *ratio ceiling* that varies by underwriting path and compensating
 * factors: qualifyForUSMortgage() computes the payment at the actual
 * contract rate (via calculateMonthlyUSMortgagePayment), then checks the
 * resulting DTI against whichever of 36% / 45% / 50% applies.
 */
export function calculateUSDTITier(input: {
  underwritingPath: USQualifyingInput["underwritingPath"];
  creditScore: number;
  reserveMonths: number;
  loanToValuePercent: number;
}): USDTITierResult {
  const { underwritingPath, creditScore, reserveMonths, loanToValuePercent } = input;

  if (underwritingPath === "automated") {
    return {
      underwritingPath,
      compensatingFactorMet: false,
      maxDTIRatio: US_DTI_AUTOMATED_MAX,
      tierLabel: "automated",
    };
  }

  const compensatingFactorMet =
    creditScore >= US_DTI_COMPENSATING_MIN_CREDIT_SCORE ||
    reserveMonths >= US_DTI_COMPENSATING_MIN_RESERVE_MONTHS ||
    loanToValuePercent <= US_DTI_COMPENSATING_MAX_LTV;

  return {
    underwritingPath,
    compensatingFactorMet,
    maxDTIRatio: compensatingFactorMet ? US_DTI_COMPENSATING_MAX : US_DTI_MANUAL_MAX,
    tierLabel: compensatingFactorMet ? "manual_compensating" : "manual_baseline",
  };
}

export function checkConformingLoanLimit(
  loanAmount: number,
  isHighCostArea: boolean
): USConformingLoanLimitCheck {
  const applicableLimit = isHighCostArea
    ? US_CONFORMING_LOAN_LIMIT_HIGH_COST
    : US_CONFORMING_LOAN_LIMIT_STANDARD;

  return {
    loanAmount,
    applicableLimit,
    exceedsConformingLimit: loanAmount > applicableLimit,
  };
}

export function qualifyForUSMortgage(input: USQualifyingInput): USQualifyingResult {
  const {
    purchasePrice,
    downPaymentPercent,
    contractRate,
    amortizationYears,
    annualPropertyTax,
    annualHomeownersInsurance,
    monthlyHOADues = 0,
    otherMonthlyDebtPayments,
    grossAnnualIncome,
    underwritingPath,
    creditScore,
    reserveMonths,
    isHighCostArea,
    monthlyMortgageInsurance = 0,
  } = input;

  const loanAmount = purchasePrice * (1 - downPaymentPercent);
  const loanToValuePercent = 1 - downPaymentPercent;

  const dtiTier = calculateUSDTITier({
    underwritingPath,
    creditScore,
    reserveMonths,
    loanToValuePercent,
  });

  const monthlyMortgagePayment = calculateMonthlyUSMortgagePayment({
    purchasePrice,
    downPaymentPercent,
    annualInterestRate: contractRate,
    amortizationYears,
  });

  const monthlyGrossIncome = grossAnnualIncome / 12;

  // PITIA + MI (if supplied) + other debt — 100% of HOA dues count, unlike
  // Canadian GDS's 50% condo-fee treatment.
  const backEndNumerator =
    monthlyMortgagePayment +
    annualPropertyTax / 12 +
    annualHomeownersInsurance / 12 +
    monthlyHOADues +
    monthlyMortgageInsurance +
    otherMonthlyDebtPayments;

  const backEndDTIRatio = backEndNumerator / monthlyGrossIncome;
  const dtiPass = backEndDTIRatio <= dtiTier.maxDTIRatio;

  const conformingLoanLimitCheck = checkConformingLoanLimit(loanAmount, isHighCostArea);

  const issues: string[] = [];
  if (conformingLoanLimitCheck.exceedsConformingLimit) {
    issues.push(
      `Loan amount $${loanAmount.toFixed(2)} exceeds the applicable conforming limit of $${conformingLoanLimitCheck.applicableLimit.toFixed(2)} — this deal would need jumbo financing, which has different underwriting conventions not modeled here (Phase 2).`
    );
  }

  return {
    dtiTier,
    monthlyMortgagePayment,
    backEndDTIRatio,
    dtiPass,
    qualifies: dtiPass,
    conformingLoanLimitCheck,
    issues,
  };
}
