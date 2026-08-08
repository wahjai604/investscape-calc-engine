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
import { MortgageInput, MortgageCountry, AmortizationRow, AmortizingTranche, TrancheAmortizationRow } from "./types";

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
 * calls this once per tranche and sums the rows itself; Tranche has no
 * term/amortization-years field today, so per-tranche schedules aren't
 * wireable end-to-end yet — that's a capitalstack.ts schema gap, not
 * something to invent here).
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
function compoundingRateForTranche(tranche: AmortizingTranche): number {
  return tranche.type === "senior_debt"
    ? semiAnnualToMonthlyRate(tranche.annualRate)
    : monthlyCompoundingRate(tranche.annualRate);
}

function monthlyTrancheRows(tranche: AmortizingTranche): TrancheAmortizationRow[] {
  const monthlyRate = compoundingRateForTranche(tranche);
  const totalMonths = tranche.amortizationYears * 12;
  const payment = PMT(monthlyRate, totalMonths, -tranche.amount);

  const rows: TrancheAmortizationRow[] = [];
  let balance = tranche.amount;

  for (let month = 1; month <= totalMonths; month++) {
    const beginningBalance = balance;
    const interest = beginningBalance * monthlyRate;
    const principal = payment - interest;
    balance -= principal;

    rows.push({ period: month, beginningBalance, payment, principal, interest, endingBalance: balance });
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
  tranche: AmortizingTranche,
  frequency: "monthly" | "annual" = "monthly",
): TrancheAmortizationRow[] {
  const monthlyRows = monthlyTrancheRows(tranche);
  return frequency === "monthly" ? monthlyRows : annualizeTrancheRows(monthlyRows, tranche.amortizationYears);
}
