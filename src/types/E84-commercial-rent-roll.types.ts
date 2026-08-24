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

/** How base rent steps up over the lease term. Only `percent_per_year` is currently modeled numerically by this engine's functions (they operate on the lease's CURRENT baseRentPsfPerYear, not a projected schedule) — `fixed_steps` and `none` are captured as data so the input shape matches a real rent roll and future engines can build a projection, but no function here reads escalationRate for anything but `percent_per_year`. */
export type CommercialRentRollEscalationType = "percent_per_year" | "fixed_steps" | "none";

/** Which party pays operating expenses, and how much: Full-Service Gross (landlord pays, 0% recovery is typical), Modified Gross (split), or Triple Net (tenant reimburses ~100%). Informational on the input — recoveryPercent (not this field) is what calculateBaseRentAndRecoveries actually consumes, since two NNN leases can still have different negotiated recoveryPercent values. */
export type CommercialLeaseStructure = "FSG" | "MG" | "NNN";

export interface CommercialRentRollSuite {
  suiteId: string;
  tenantName: string;
  areaSf: number;
  /** ISO YYYY-MM-DD */
  leaseStart: string;
  /** ISO YYYY-MM-DD */
  leaseEnd: string;
  baseRentPsfPerYear: number;
  escalationType: CommercialRentRollEscalationType;
  /** % per year, only meaningful when escalationType === 'percent_per_year'. */
  escalationRate: number;
  leaseStructure: CommercialLeaseStructure;
  /** 0-100, % of allocated opex the tenant reimburses. */
  recoveryPercent: number;
  /** 0-100. */
  renewalProbabilityPercent: number;
  tiPsf: number;
  lcPercent: number;
  /** false = vacant suite (no tenant, still has areaSf). */
  isOccupied: boolean;
}

export interface RolloverYear {
  year: number;
  /** 0-100, of total annualized base rent across ALL suites (occupied + vacant) — see calculateRolloverSchedule's doc comment for why vacant suites are in the denominator but never the numerator. */
  expiringRentPercent: number;
  /** 0-100, of total area across ALL suites. */
  expiringAreaPercent: number;
  expiringSuiteIds: string[];
}

export interface RentRollOccupancy {
  occupancyByArea: number;
}

export interface RentRollIncomeBreakdown {
  baseRentTotal: number;
  recoveriesTotal: number;
  /** baseRentTotal + recoveriesTotal. */
  grossIncome: number;
}

export interface ExpiryConcentration {
  maxSingleYearExpiryPercent: number;
  maxSingleYearExpiryYear: number;
  /** True when maxSingleYearExpiryPercent >= COMMERCIAL_RENT_ROLL_EXPIRY_CONCENTRATION_THRESHOLD_PERCENT. */
  isConcentrated: boolean;
}
