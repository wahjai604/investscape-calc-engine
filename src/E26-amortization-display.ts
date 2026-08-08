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

import { amortizationSchedule } from "./E2-amortization";
import {
  MortgageInput,
  DisplayTrancheType,
  DisplayTranche,
  AmortizationDisplayInput,
  DisplayMonthlyRow,
  DisplayAnnualRow,
  TrancheSchedule,
  AmortizationDisplayResult,
} from "./types";

const TRANCHE_COLORS: Record<DisplayTrancheType, string> = {
  senior: "blue",
  mezzanine: "orange",
  equity: "gold",
};

/**
 * amortizationSchedule() takes a MortgageInput (purchasePrice/downPaymentPercent),
 * not a raw principal — expressed as purchasePrice with 0% down so
 * purchasePrice * (1 - downPaymentPercent) equals the tranche's loanAmount
 * either way (same trick used for AmortizingTranche in amortization.ts).
 */
function loanFor(tranche: DisplayTranche): MortgageInput {
  return {
    purchasePrice: tranche.loanAmount,
    downPaymentPercent: 0,
    annualInterestRate: tranche.annualInterestRate,
    amortizationYears: tranche.amortizationYears,
  };
}

/**
 * Rolls a tranche's monthly rows into one summary row per tranche-local
 * year. Chunks by array position (12 rows per year) rather than by the
 * global `month` field, since monthly_rows.month is already shifted by
 * drawDate_month and array order still reflects the tranche's own
 * sequential payment history.
 */
function annualizeMonthlyRows(monthlyRows: DisplayMonthlyRow[], amortizationYears: number): DisplayAnnualRow[] {
  const rows: DisplayAnnualRow[] = [];

  for (let year = 1; year <= amortizationYears; year++) {
    const yearRows = monthlyRows.slice((year - 1) * 12, year * 12);

    rows.push({
      year,
      beginning_balance: yearRows[0].beginning_balance,
      annual_payment: yearRows.reduce((sum, row) => sum + row.payment, 0),
      annual_principal: yearRows.reduce((sum, row) => sum + row.principal, 0),
      annual_interest: yearRows.reduce((sum, row) => sum + row.interest, 0),
      ending_balance: yearRows[yearRows.length - 1].ending_balance,
    });
  }

  return rows;
}

function buildTrancheSchedule(tranche: DisplayTranche): TrancheSchedule {
  const loan = loanFor(tranche);
  const totalPayments = tranche.amortizationYears * 12;
  const localRows = amortizationSchedule(loan, tranche.country, totalPayments);

  // AmortizationRow has no beginningBalance field; it's recovered here as
  // closingBalance + principalPaid (what the balance was before this
  // period's principal was applied), rather than tracking a running
  // balance separately.
  const monthly_rows: DisplayMonthlyRow[] = localRows.map((row) => ({
    month: tranche.drawDate_month + row.month,
    beginning_balance: row.closingBalance + row.principalPaid,
    payment: row.payment,
    principal: row.principalPaid,
    interest: row.interestPaid,
    ending_balance: row.closingBalance,
  }));

  return {
    tranche_id: tranche.id,
    type: tranche.type,
    color: TRANCHE_COLORS[tranche.type],
    monthly_rows,
    annual_summary: annualizeMonthlyRows(monthly_rows, tranche.amortizationYears),
    payoff_month: monthly_rows[monthly_rows.length - 1].month,
    total_interest_paid: monthly_rows.reduce((sum, row) => sum + row.interest, 0),
  };
}

/**
 * Builds each tranche's independent amortization schedule (shifted onto a
 * shared global timeline by its own drawDate_month) plus a combined view
 * summarizing when the whole capital stack reaches $0.
 */
export function generateAmortizationDisplay(input: AmortizationDisplayInput): AmortizationDisplayResult {
  const tranche_schedules = input.tranches.map(buildTrancheSchedule);
  const all_tranches_zero_month = Math.max(...tranche_schedules.map((schedule) => schedule.payoff_month));

  return {
    tranche_schedules,
    combined_view: {
      month_count: all_tranches_zero_month,
      all_tranches_zero_month,
    },
  };
}

/**
 * Looks up one tranche's full schedule from an already-generated display
 * result — the drill-down table a UI shows when a user selects that
 * tranche's line on the combined chart. Returns the same TrancheSchedule
 * shape generateAmortizationDisplay() already produces (monthly_rows /
 * annual_summary ARE the drill-down table) rather than a separate format.
 */
export function getTrancheSummary(tranche_id: string, result: AmortizationDisplayResult): TrancheSchedule {
  const schedule = result.tranche_schedules.find((s) => s.tranche_id === tranche_id);
  if (!schedule) {
    throw new Error(`No tranche schedule found for tranche_id "${tranche_id}"`);
  }

  return schedule;
}
