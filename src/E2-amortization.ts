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
 * Standard construction-finance drawdown curve: monotonic 0→1, symmetric,
 * slow-fast-slow. Same formula as the companion HTML reconstruction's
 * chart/interest-reserve S-curve — kept here as the engine's own copy
 * since the two codebases are intentionally decoupled, not because the
 * math differs.
 */
function smoothstep(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return 3 * clamped * clamped - 2 * clamped * clamped * clamped;
}

/**
 * Drawn balance at a given point into the construction period, following
 * the S-curve rather than jumping straight to the full committed amount.
 * monthsIntoConstruction is 1-indexed from the first draw month (i.e. the
 * first month after drawMonth is monthsIntoConstruction = 1).
 */
function scurveDrawnBalance(tranche: Tranche, monthsIntoConstruction: number, constructionMonths: number): number {
  return tranche.amount * smoothstep(monthsIntoConstruction / constructionMonths);
}

/**
 * Discrete average of the curve's cumulative-drawn fraction across whole
 * construction months — converges to the continuous integral's exact 0.5
 * for any reasonably long construction period, since the curve is
 * symmetric. Exposed so callers who need a single scalar reference value
 * (e.g. a reserve-sizing formula, rather than a full monthly schedule)
 * don't have to re-derive this.
 */
export function averageDrawFactor(constructionMonths: number): number {
  if (constructionMonths <= 0) {
    throw new Error(`averageDrawFactor: constructionMonths must be positive, got ${constructionMonths}.`);
  }
  let sum = 0;
  for (let month = 1; month <= constructionMonths; month++) {
    sum += smoothstep(month / constructionMonths);
  }
  return sum / constructionMonths;
}

function requireConstructionMonths(tranche: Tranche, drawMonth: number, bulletRepaymentMonth: number): number {
  const constructionMonths = tranche.constructionMonths;
  if (constructionMonths === undefined) {
    throw new Error(
      `interestOnlyBulletTrancheRows: tranche has drawSchedule "scurve" but is missing constructionMonths.`,
    );
  }
  if (constructionMonths > bulletRepaymentMonth - drawMonth) {
    throw new Error(
      `interestOnlyBulletTrancheRows: constructionMonths (${constructionMonths}) exceeds the tranche's own term ` +
        `(bulletRepaymentMonth ${bulletRepaymentMonth} - drawMonth ${drawMonth} = ${bulletRepaymentMonth - drawMonth}).`,
    );
  }
  return constructionMonths;
}

function resolveBeginningBalance(tranche: Tranche, period: number, drawMonth: number, bulletRepaymentMonth: number): number {
  if (tranche.drawSchedule !== "scurve") {
    return tranche.amount; // existing flat behavior, unchanged default
  }
  const constructionMonths = requireConstructionMonths(tranche, drawMonth, bulletRepaymentMonth);
  const monthsIntoConstruction = period - drawMonth;
  if (monthsIntoConstruction >= constructionMonths) {
    return tranche.amount; // construction complete, fully drawn, flat until bullet repayment
  }
  return scurveDrawnBalance(tranche, monthsIntoConstruction, constructionMonths);
}

/**
 * The construction-loan mechanic: rows 1..drawMonth are the same
 * undrawn/zero rows as the amortizing path (reused draw-timing logic), then
 * the facility sits interest-only (no scheduled principal paydown) until
 * bulletRepaymentMonth, where the entire balance is repaid in one lump sum.
 * endingBalance on that final row is explicitly 0 — a genuine $0 payoff,
 * not a "repaid" flag left sitting on a stale nonzero balance (see
 * buildPresaleDepositSchedule()'s known gap, which this mechanic
 * deliberately does not repeat).
 *
 * By default the facility is treated as fully drawn from the month after
 * drawMonth (tranche.drawSchedule omitted or "flat") — correct for plain
 * bridge/bullet debt. Setting drawSchedule: "scurve" instead ramps the
 * balance up over constructionMonths following a standard construction-
 * finance S-curve, correct for a genuine construction loan that draws down
 * progressively as the building gets built.
 */
function interestOnlyBulletTrancheRows(tranche: Tranche, drawMonth: number): TrancheAmortizationRow[] {
  const bulletRepaymentMonth = requireBulletRepaymentMonth(tranche, drawMonth);
  const monthlyRate = compoundingRateForTranche(tranche);

  const rows: TrancheAmortizationRow[] = [];

  for (let month = 1; month <= drawMonth; month++) {
    rows.push({ period: month, beginningBalance: 0, payment: 0, principal: 0, interest: 0, endingBalance: 0 });
  }

  for (let period = drawMonth + 1; period <= bulletRepaymentMonth; period++) {
    const beginningBalance = resolveBeginningBalance(tranche, period, drawMonth, bulletRepaymentMonth);
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

  if (tranche.drawSchedule === "scurve" && tranche.repaymentType !== "interest_only_bullet") {
    throw new Error(
      `monthlyTrancheRows: drawSchedule "scurve" only applies to repaymentType "interest_only_bullet", got "${tranche.repaymentType}".`,
    );
  }

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
 * releases more of the trust (per tranche.milestones), and the whole
 * outstanding balance is retired in a single bullet repayment at
 * repaymentMonth rather than paid down period over period.
 *
 * interestAccrued is intentionally always 0 here. A presale deposit is
 * buyer earnest money held in the developer's lawyer's trust account as
 * proof of demand for the bank's gate — it is not a loan the developer has
 * drawn, and the developer pays no interest on it. It nets against the
 * buyer's final purchase price at completion. tranche.rate is still
 * accepted on the type for backward compatibility with existing saved
 * deals, but is deliberately not read here — do not reintroduce an
 * interest calculation on this facility type without re-litigating this
 * decision; see the "Presale Gate Rework" design doc, Aug 24 2026.
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

  for (let month = 1; month <= repaymentMonth; month++) {
    const drawnBalance = drawnBalanceAt(month);

    rows.push({
      period: month,
      drawnBalance,
      interestAccrued: 0,
      cumulativeInterest: 0,
      repaid: month === repaymentMonth,
    });
  }

  return rows;
}
