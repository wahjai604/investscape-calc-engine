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

import {
  PMT,
  calculateMonthlyMortgagePayment,
  calculateMonthlyUSMortgagePayment,
  semiAnnualToMonthlyRate,
  monthlyCompoundingRate,
} from "./E1-mortgage";
import {
  MortgageInput,
  MortgageCountry,
  AmortizationRow,
  Tranche,
  TrancheAmortizationRow,
  PresaleDepositScheduleRow,
} from "./types";

function resolvePaymentAndRate(loan: MortgageInput, country: MortgageCountry): { payment: number; monthlyRate: number } {
  if (country === "Canada") {
    return {
      payment: calculateMonthlyMortgagePayment(loan),
      monthlyRate: semiAnnualToMonthlyRate(loan.annualInterestRate),
    };
  }

  return {
    payment: calculateMonthlyUSMortgagePayment(loan),
    monthlyRate: monthlyCompoundingRate(loan.annualInterestRate),
  };
}

/**
 * Row-by-row amortization for a single loan (one tranche's worth — a
 * caller amortizing a multi-tranche capital stack, per capitalstack.ts,
 * calls this once per tranche and sums the rows itself; see
 * trancheAmortizationSchedule() below for the per-tranche equivalent that
 * works directly off Tranche's amount/rate/amortizationYears).
 *
 * The payment is never recomputed here — it's taken as-is from mortgage.ts's
 * existing, FCAC-validated payment functions and held constant across every
 * row, matching this loan's fixed-rate assumption. Each row then applies
 * standard mechanics: interestPaid is the period's effective rate against
 * the running balance, principalPaid is what's left of the fixed payment,
 * and closingBalance carries forward.
 */
export function amortizationSchedule(loan: MortgageInput, country: MortgageCountry, months: number): AmortizationRow[] {
  const { payment, monthlyRate } = resolvePaymentAndRate(loan, country);
  const totalPayments = loan.amortizationYears * 12;
  const rowCount = Math.min(months, totalPayments);

  const rows: AmortizationRow[] = [];
  let balance = loan.purchasePrice * (1 - loan.downPaymentPercent);

  for (let month = 1; month <= rowCount; month++) {
    const interestPaid = balance * monthlyRate;
    const principalPaid = payment - interestPaid;
    balance -= principalPaid;

    rows.push({ month, payment, principalPaid, interestPaid, closingBalance: balance });
  }

  return rows;
}

/**
 * Loan payoff balance at a specific month. A thin wrapper over
 * amortizationSchedule() rather than a separate closed-form balance
 * formula, so there's exactly one place amortization math lives.
 */
export function remainingBalance(loan: MortgageInput, country: MortgageCountry, monthsElapsed: number): number {
  const schedule = amortizationSchedule(loan, country, monthsElapsed);
  return schedule[schedule.length - 1].closingBalance;
}

/**
 * Senior debt is the only tranche type commercial lenders actually
 * amortize under Canadian semi-annual compounding convention; mezzanine and
 * equity fall back to US monthly compounding. Equity tranches don't
 * amortize in practice (no scheduled principal paydown), so calling this
 * for one is a hypothetical, not a real use case — but the convention
 * still has to resolve to something, and monthly is the closer analogue.
 */
function compoundingRateForTranche(tranche: Tranche): number {
  return tranche.type === "senior_debt"
    ? semiAnnualToMonthlyRate(tranche.rate)
    : monthlyCompoundingRate(tranche.rate);
}

function requireAmortizationYears(tranche: Tranche): number {
  if (tranche.amortizationYears === undefined) {
    throw new Error(`trancheAmortizationSchedule: tranche of type "${tranche.type}" is missing amortizationYears.`);
  }
  return tranche.amortizationYears;
}

function requireBulletRepaymentMonth(tranche: Tranche, drawMonth: number): number {
  const bulletRepaymentMonth = tranche.bulletRepaymentMonth;
  if (bulletRepaymentMonth === undefined) {
    throw new Error(
      `monthlyTrancheRows: tranche of type "${tranche.type}" has repaymentType "interest_only_bullet" but is missing bulletRepaymentMonth.`,
    );
  }
  if (bulletRepaymentMonth <= drawMonth) {
    throw new Error(
      `monthlyTrancheRows: bulletRepaymentMonth (${bulletRepaymentMonth}) must be greater than drawMonth (${drawMonth}).`,
    );
  }
  return bulletRepaymentMonth;
}

/**
 * The construction-loan mechanic: rows 1..drawMonth are the same
 * undrawn/zero rows as the amortizing path (reused draw-timing logic), then
 * the facility sits interest-only at its full drawn amount every period
 * (no principal paydown) until bulletRepaymentMonth, where the entire
 * balance is repaid in one lump sum. endingBalance on that final row is
 * explicitly 0 — a genuine $0 payoff, not a "repaid" flag left sitting on a
 * stale nonzero balance (see buildPresaleDepositSchedule()'s known gap,
 * which this mechanic deliberately does not repeat).
 */
function interestOnlyBulletTrancheRows(tranche: Tranche, drawMonth: number): TrancheAmortizationRow[] {
  const bulletRepaymentMonth = requireBulletRepaymentMonth(tranche, drawMonth);
  const monthlyRate = compoundingRateForTranche(tranche);

  const rows: TrancheAmortizationRow[] = [];

  for (let month = 1; month <= drawMonth; month++) {
    rows.push({ period: month, beginningBalance: 0, payment: 0, principal: 0, interest: 0, endingBalance: 0 });
  }

  for (let period = drawMonth + 1; period <= bulletRepaymentMonth; period++) {
    const beginningBalance = tranche.amount;
    const interest = beginningBalance * monthlyRate;
    const isBulletMonth = period === bulletRepaymentMonth;
    const principal = isBulletMonth ? tranche.amount : 0;
    const endingBalance = isBulletMonth ? 0 : beginningBalance;

    rows.push({ period, beginningBalance, payment: interest + principal, principal, interest, endingBalance });
  }

  return rows;
}

function monthlyTrancheRows(tranche: Tranche): TrancheAmortizationRow[] {
  const drawMonth = tranche.drawMonth ?? 0;

  if (tranche.repaymentType === "interest_only_bullet") {
    return interestOnlyBulletTrancheRows(tranche, drawMonth);
  }

  const monthlyRate = compoundingRateForTranche(tranche);
  const totalMonths = requireAmortizationYears(tranche) * 12;
  const payment = PMT(monthlyRate, totalMonths, -tranche.amount);

  const rows: TrancheAmortizationRow[] = [];

  for (let month = 1; month <= drawMonth; month++) {
    rows.push({ period: month, beginningBalance: 0, payment: 0, principal: 0, interest: 0, endingBalance: 0 });
  }

  let balance = tranche.amount;

  for (let month = 1; month <= totalMonths; month++) {
    const beginningBalance = balance;
    const interest = beginningBalance * monthlyRate;
    const principal = payment - interest;
    balance -= principal;

    rows.push({ period: drawMonth + month, beginningBalance, payment, principal, interest, endingBalance: balance });
  }

  return rows;
}

function annualizeTrancheRows(monthlyRows: TrancheAmortizationRow[], amortizationYears: number): TrancheAmortizationRow[] {
  const rows: TrancheAmortizationRow[] = [];

  for (let year = 1; year <= amortizationYears; year++) {
    const yearRows = monthlyRows.slice((year - 1) * 12, year * 12);

    rows.push({
      period: year,
      beginningBalance: yearRows[0].beginningBalance,
      payment: yearRows.reduce((sum, row) => sum + row.payment, 0),
      principal: yearRows.reduce((sum, row) => sum + row.principal, 0),
      interest: yearRows.reduce((sum, row) => sum + row.interest, 0),
      endingBalance: yearRows[yearRows.length - 1].endingBalance,
    });
  }

  return rows;
}

/**
 * Per-tranche amortization schedule, keyed off the tranche's own
 * amount/rate/term rather than a whole-loan MortgageInput. Monthly rows are
 * always computed first since that's where the compounding math applies;
 * "annual" just rolls twelve of those rows into one summary row per year.
 */
export function trancheAmortizationSchedule(
  tranche: Tranche,
  frequency: "monthly" | "annual" = "monthly",
): TrancheAmortizationRow[] {
  const monthlyRows = monthlyTrancheRows(tranche);
  return frequency === "monthly" ? monthlyRows : annualizeTrancheRows(monthlyRows, requireAmortizationYears(tranche));
}

/**
 * Draw/repayment schedule for a presale_deposit facility. Deliberately not
 * a loan-amortization variant: drawnBalance only steps up when a milestone
 * releases more of the trust (per tranche.milestones), interest accrues
 * interest-only against whatever's currently drawn (US-style monthly
 * compounding, same fallback E2 already uses for mezzanine/equity), and the
 * whole outstanding balance is retired in a single bullet repayment at
 * repaymentMonth rather than paid down period over period.
 */
export function buildPresaleDepositSchedule(tranche: Tranche, repaymentMonth: number): PresaleDepositScheduleRow[] {
  if (tranche.type !== "presale_deposit") {
    throw new Error(`buildPresaleDepositSchedule: expected type "presale_deposit", got "${tranche.type}".`);
  }
  const milestones = tranche.milestones;
  if (!milestones || milestones.length === 0) {
    throw new Error("buildPresaleDepositSchedule: tranche is missing milestones.");
  }

  const sortedMilestones = [...milestones].sort((a, b) => a.month - b.month);
  const monthlyRate = monthlyCompoundingRate(tranche.rate);

  function drawnBalanceAt(month: number): number {
    let releasePercent = 0;
    for (const milestone of sortedMilestones) {
      if (milestone.month <= month) {
        releasePercent = milestone.cumulativeReleasePercent;
      }
    }
    return tranche.amount * releasePercent;
  }

  const rows: PresaleDepositScheduleRow[] = [];
  let cumulativeInterest = 0;

  for (let month = 1; month <= repaymentMonth; month++) {
    const drawnBalance = drawnBalanceAt(month);
    const interestAccrued = drawnBalance * monthlyRate;
    cumulativeInterest += interestAccrued;

    rows.push({
      period: month,
      drawnBalance,
      interestAccrued,
      cumulativeInterest,
      repaid: month === repaymentMonth,
    });
  }

  return rows;
}
