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
 * Commercial rent rolls are shaped nothing like residential ones. A
 * residential rent roll can average across units ("12 x 1BR @ $1,500/mo")
 * because the units are fungible. Commercial suites are not: a 5-year NNN
 * lease to a national tenant and a 1-year FSG lease to a startup occupying
 * the same square footage carry completely different risk, and averaging
 * across them destroys exactly the information a lender or buyer needs —
 * term remaining, expiry concentration, and who is on the hook for opex.
 * This engine is deliberately per-suite/per-tenant and does not touch (or
 * share types with) the existing residential rent roll engine.
 */

import { CommercialRentRollSuite, RolloverYear, RentRollOccupancy, RentRollIncomeBreakdown, ExpiryConcentration } from "./types";
import { COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT } from "./utils/constants";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Calendar-accurate-enough year difference for lease-term math (fractional, can be negative). Uses a 365.25-day year rather than exact calendar arithmetic (leap years, variable month lengths) because remaining lease term is a WALT input, not a legal date computation — sub-day precision isn't meaningful here. */
function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_YEAR;
}

/**
 * Weighted Average Lease Term, rent-weighted (not area-weighted) — the
 * standard commercial rent-roll convention, because a large low-rent
 * suite rolling over should not dominate WALT the way it would dominate
 * an area-weighted average; rent-weighting reflects income at risk, which
 * is what WALT is meant to communicate to a lender or buyer.
 *
 * Only occupied suites contribute: a vacant suite has no lease, so it has
 * no remaining term and no rent to weight it by. Including it (e.g. at
 * remainingYears = 0) would silently drag WALT down and misrepresent the
 * occupied portfolio's actual lease term.
 *
 * Empty-input behavior: with zero occupied suites, both the numerator and
 * denominator are 0. This returns 0 explicitly (not NaN or Infinity) —
 * document this as the defined behavior for "no leases to measure," not a
 * meaningful lease term of zero years.
 */
export function calculateWALT(suites: CommercialRentRollSuite[], asOfDate: Date): number {
  const occupied = suites.filter((suite) => suite.isOccupied);

  let weightedYearsSum = 0;
  let weightSum = 0;

  for (const suite of occupied) {
    const remainingYears = Math.max(yearsBetween(asOfDate, new Date(suite.leaseEnd)), 0);
    const weight = suite.baseRentPsfPerYear * suite.areaSf;
    weightedYearsSum += remainingYears * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return 0;
  }

  return weightedYearsSum / weightSum;
}

/**
 * Buckets lease expirations by calendar year for the next `yearsAhead`
 * years starting with asOfDate's own calendar year. `yearsAhead` is a
 * required parameter, not a defaulted one — matching this codebase's
 * existing convention (e.g. E83's CommercialLoanSizingInput has no
 * optional/defaulted fields) of forcing callers to state their own
 * analysis horizon rather than silently inheriting an engine's guess at
 * what "reasonable" looks like.
 *
 * Only occupied suites can expire — a vacant suite has no active lease,
 * so it contributes to neither expiringRentPercent nor
 * expiringAreaPercent for any year (it's already "expired"/available
 * today, not expiring in the future). Both percentages are of the TOTAL
 * portfolio (occupied + vacant), not of the occupied subset, so the
 * numbers are directly comparable to calculateOccupancy's denominator and
 * so a heavily-vacant building doesn't have its rollover risk overstated
 * by shrinking the denominator down to just the occupied suites.
 *
 * A suite is only counted as expiring in a given year if its leaseEnd
 * falls in that calendar year AND on or after asOfDate — a suite whose
 * lease technically already ended before asOfDate isn't a future rollover
 * event even if isOccupied is still (incorrectly) true in the input data.
 */
export function calculateRolloverSchedule(
  suites: CommercialRentRollSuite[],
  asOfDate: Date,
  yearsAhead: number
): RolloverYear[] {
  const totalRent = suites
    .filter((suite) => suite.isOccupied)
    .reduce((sum, suite) => sum + suite.baseRentPsfPerYear * suite.areaSf, 0);
  const totalArea = suites.reduce((sum, suite) => sum + suite.areaSf, 0);

  // Both leaseEnd (an ISO YYYY-MM-DD string, which Date parses as UTC
  // midnight) and asOfDate are bucketed by UTC calendar year — using the
  // local-timezone getFullYear() instead would shift dates near a year
  // boundary into the wrong bucket depending on the machine/CI runner's
  // timezone offset from UTC.
  const startYear = asOfDate.getUTCFullYear();
  const schedule: RolloverYear[] = [];

  for (let i = 0; i < yearsAhead; i++) {
    const year = startYear + i;

    const expiringSuites = suites.filter((suite) => {
      if (!suite.isOccupied) return false;
      const leaseEnd = new Date(suite.leaseEnd);
      return leaseEnd.getUTCFullYear() === year && leaseEnd.getTime() >= asOfDate.getTime();
    });

    const expiringRent = expiringSuites.reduce((sum, suite) => sum + suite.baseRentPsfPerYear * suite.areaSf, 0);
    const expiringArea = expiringSuites.reduce((sum, suite) => sum + suite.areaSf, 0);

    schedule.push({
      year,
      expiringRentPercent: totalRent === 0 ? 0 : (expiringRent / totalRent) * 100,
      expiringAreaPercent: totalArea === 0 ? 0 : (expiringArea / totalArea) * 100,
      expiringSuiteIds: expiringSuites.map((suite) => suite.suiteId),
    });
  }

  return schedule;
}

/**
 * Deliberately returns ONLY occupancyByArea. An "occupancy by rent" metric
 * was considered and rejected: rent-weighted occupancy would need a
 * potential/market rent figure for vacant suites to divide occupied rent
 * by, and this input shape has no market-rent assumption for vacant
 * space (vacant suites have no baseRentPsfPerYear — there's no lease to
 * read one from). Two ways of faking it were both rejected as dishonest:
 *   1. occupiedRent / occupiedRent always equals 100% and would be
 *      meaningless — it can never show vacancy by construction.
 *   2. Silently returning occupancyByArea again under an "occupancyByRent"
 *      label would misrepresent an area figure as a rent figure.
 * Producing a real occupancy-by-rent number would require inventing a
 * market-rent assumption this engine doesn't have and shouldn't guess at;
 * that belongs in a future engine that's explicitly given market rents,
 * not smuggled into this one's return type.
 */
export function calculateOccupancy(suites: CommercialRentRollSuite[]): RentRollOccupancy {
  const totalArea = suites.reduce((sum, suite) => sum + suite.areaSf, 0);
  const occupiedArea = suites.filter((suite) => suite.isOccupied).reduce((sum, suite) => sum + suite.areaSf, 0);

  return {
    occupancyByArea: totalArea === 0 ? 0 : occupiedArea / totalArea,
  };
}

/**
 * Allocates the building's total annual opex pro-rata by area across ALL
 * suites (occupied and vacant alike get an allocated share, since opex
 * like property tax and insurance doesn't shrink just because a suite is
 * empty) and then charges each OCCUPIED suite its recoveryPercent share
 * of its own allocated opex. This pro-rata-by-area allocation is a stated
 * MVP simplification, not a hidden shortcut: real commercial recovery
 * allocation can vary by lease (e.g. a base-year stop, a cap on
 * controllable expenses, gross-up clauses for partially-occupied
 * buildings) in ways this input shape doesn't capture. recoveryPercent
 * itself is where lease-specific variation is expressed here.
 */
export function calculateBaseRentAndRecoveries(
  suites: CommercialRentRollSuite[],
  totalBuildingAnnualOpex: number
): RentRollIncomeBreakdown {
  const totalArea = suites.reduce((sum, suite) => sum + suite.areaSf, 0);

  const baseRentTotal = suites
    .filter((suite) => suite.isOccupied)
    .reduce((sum, suite) => sum + suite.baseRentPsfPerYear * suite.areaSf, 0);

  const recoveriesTotal = suites
    .filter((suite) => suite.isOccupied)
    .reduce((sum, suite) => {
      const allocatedOpex = totalArea === 0 ? 0 : totalBuildingAnnualOpex * (suite.areaSf / totalArea);
      return sum + allocatedOpex * (suite.recoveryPercent / 100);
    }, 0);

  return {
    baseRentTotal,
    recoveriesTotal,
    grossIncome: baseRentTotal + recoveriesTotal,
  };
}

/**
 * Takes calculateRolloverSchedule's output as input and does not
 * recompute anything from the raw suites — it just finds the single
 * worst year and compares it against the named threshold constant.
 */
export function calculateExpiryConcentration(rolloverSchedule: RolloverYear[]): ExpiryConcentration {
  if (rolloverSchedule.length === 0) {
    return { maxSingleYearExpiryPercent: 0, maxSingleYearExpiryYear: 0, isConcentrated: false };
  }

  const worst = rolloverSchedule.reduce((max, year) =>
    year.expiringRentPercent > max.expiringRentPercent ? year : max
  );

  return {
    maxSingleYearExpiryPercent: worst.expiringRentPercent,
    maxSingleYearExpiryYear: worst.year,
    isConcentrated: worst.expiringRentPercent >= COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT,
  };
}
