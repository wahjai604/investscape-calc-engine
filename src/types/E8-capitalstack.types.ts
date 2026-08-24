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

export type TrancheType = "senior_debt" | "mezzanine" | "equity" | "presale_deposit";

/**
 * How a senior_debt/mezzanine facility's schedule pays down principal.
 * "amortizing" is today's existing PMT-based P&I behavior (the default when
 * repaymentType is omitted). "interest_only_bullet" is the construction-loan
 * mechanic: interest-only through the build, full principal repaid in one
 * lump sum from unit-sale proceeds at project completion — see
 * bulletRepaymentMonth on Tranche.
 */
export type TrancheRepaymentType = "amortizing" | "interest_only_bullet";

/**
 * A step in a presale_deposit facility's trust-release schedule. Presale
 * deposits are held in trust and released to the project in chunks as
 * milestones are hit (e.g. building permit, an absorption threshold,
 * completion) — not drawn continuously like a construction loan and not
 * paid down period over period like an amortizing loan.
 */
export interface PresaleMilestone {
  /** Month (0 = deal start) at which this milestone's release becomes available. */
  month: number;
  /** Cumulative share (0–1) of the facility's total amount released as of this milestone. Must be non-decreasing across milestones and reach 1 by the last one. */
  cumulativeReleasePercent: number;
}

/**
 * Unified tranche shape (see E2-amortization.ts's amortizationSchedule.ts
 * doc comment history / Doc 66-era "capitalstack.ts schema gap" note): this
 * one Tranche interface now carries both the capital-stack fields
 * (amount/rate) and the amortization-schedule field (amortizationYears)
 * that used to live on a separate, parallel AmortizingTranche type in
 * E2-amortization.types.ts. AmortizingTranche has been removed —
 * trancheAmortizationSchedule() takes a Tranche directly and requires
 * amortizationYears to be set (it throws otherwise), rather than a second
 * shape existing alongside this one.
 */
export interface Tranche {
  type: TrancheType;
  amount: number;
  rate: number;
  /** Required by trancheAmortizationSchedule() for senior_debt/mezzanine facilities that carry a P&I schedule. Omit for equity and presale_deposit, which don't amortize like a loan. */
  amortizationYears?: number;
  /**
   * Month (0 = deal start) at which this senior_debt/mezzanine facility
   * draws its full balance and begins amortizing — e.g. a mezzanine that
   * draws at month 6 while the senior loan draws at month 0. Defaults to 0
   * when omitted, matching today's existing day-1-draw behavior (fully
   * backward compatible). Does NOT apply to presale_deposit, which uses
   * milestones for its own draw-timing mechanic, or to equity, which has no
   * schedule at all.
   */
  drawMonth?: number;
  /**
   * How this senior_debt/mezzanine facility's principal is repaid. Defaults
   * to "amortizing" when omitted, matching today's existing PMT-based P&I
   * behavior (fully backward compatible). Set to "interest_only_bullet" for
   * the real-world mechanic of a construction loan: interest-only accrual
   * through the build, then the full outstanding balance repaid in one
   * lump sum from unit-sale proceeds at project completion (see
   * bulletRepaymentMonth). Does not apply to presale_deposit or equity.
   */
  repaymentType?: TrancheRepaymentType;
  /**
   * Month (0 = deal start) at which an "interest_only_bullet" facility's
   * full outstanding balance is repaid in one lump sum — e.g. a 24-month
   * construction period plus a 6-month unit sell-off, giving
   * bulletRepaymentMonth: 30. Required (and must be greater than drawMonth)
   * when repaymentType is "interest_only_bullet"; ignored/unused for
   * "amortizing" facilities.
   */
  bulletRepaymentMonth?: number;
  /** Required by buildPresaleDepositSchedule() for presale_deposit facilities — the trust release schedule. Not used by other tranche types. */
  milestones?: PresaleMilestone[];
  /** Loan-to-cost — this facility's amount as a share of total project cost. Supplied by the caller (derived from project totals outside this module); echoed through, not recomputed here. */
  loanToCost?: number;
  /** Loan-to-value — this facility's amount as a share of project end value. Supplied by the caller; echoed through, not recomputed here. */
  loanToValue?: number;
  /** Dollar amount set aside at close to fund this facility's own interest payments until it's exhausted (see E78-financing-table.ts's per-facility interest reserve draw-down). */
  interestReserveAmount?: number;
  /** Lender commitment fee as a percent (0–1) of this facility's amount, charged once at close. */
  commitmentFeePercent?: number;
  /**
   * Draw schedule shape for this tranche's balance during the construction
   * period. Defaults to "flat" (today's existing behavior: fully drawn the
   * month after drawMonth) when omitted, so every existing caller and test
   * is unaffected. "scurve" only applies when repaymentType is
   * "interest_only_bullet" — it has no meaning for amortizing tranches.
   */
  drawSchedule?: "flat" | "scurve";
  /**
   * Length of the construction/draw-down period in months, starting the
   * month after drawMonth. Required when drawSchedule is "scurve". Must be
   * less than or equal to (bulletRepaymentMonth - drawMonth) — the facility
   * can't still be drawing down after it's already been repaid.
   */
  constructionMonths?: number;
}

export interface TrancheResult extends Tranche {
  interestCost: number;
  capitalWeight: number;
  /** amount * commitmentFeePercent; 0 when commitmentFeePercent is omitted. */
  commitmentFeeAmount: number;
  /** amount - interestReserveAmount - commitmentFeeAmount — the cash this facility actually nets to the project at close. */
  netAdvance: number;
}

export interface CapitalStackResult {
  tranches: TrancheResult[];
  totalCapital: number;
  totalDebtService: number;
  /** Simple weighted average of each tranche's rate by its share of total capital — NOT tax-adjusted. See wacc for that. */
  weightedAverageCost: number;
  /**
   * True tax-adjusted WACC (F-102): debt tranches (senior_debt, mezzanine)
   * get the (1 − Tc) interest tax shield applied to their rate before
   * weighting; equity does not, since equity distributions aren't a
   * tax-deductible expense. null when no taxRate is supplied — WACC isn't
   * meaningful without one, so this doesn't silently fall back to the
   * untaxed figure under a "wacc" name.
   */
  wacc: number | null;
}
