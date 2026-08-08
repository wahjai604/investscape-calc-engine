export interface RentalUnit {
  /** e.g. "Unit A", "Suite 101". */
  unitId: string;
  /** Stabilized monthly rent when occupied. */
  monthlyRent: number;
  /** 0.05 for 5% vacancy, once stabilized. */
  vacancyRatePercent: number;
  /** Month the unit becomes available. 0 = day 1. */
  rampStartMonth: number;
  /** Month the ramp completes. null = no ramp — immediate stabilized occupancy from rampStartMonth. */
  rampEndMonth: number | null;
  /** 0-1. Occupancy factor applied during the ramp window (rampStartMonth <= month < rampEndMonth). */
  occupancyDuringRamp: number;
}

export interface RentalWaterfallInput {
  units: RentalUnit[];
  /** Total months to analyze — typically 60 for a 5-year hold. */
  analysisMonths: number;
}

export interface UnitMetrics {
  unitId: string;
  stabilizedMonthlyRent: number;
  /** stabilizedMonthlyRent × 12 — the unit's full potential rent once stabilized, independent of ramp timing. */
  annualStabilizedRent: number;
  /** annualStabilizedRent × vacancyRatePercent — the unit's steady-state vacancy allowance once stabilized (not ramp-period specific; see rampImpact for the ramp timeline). */
  annualVacancyAllowance: number;
  annualEffectiveRent: number;
  /** e.g. "Ramps months 1-6 at 50% occupancy." or "No ramp — immediate occupancy from month 0." */
  rampImpact: string;
}

export interface MonthlyCashFlow {
  month: number;
  totalGrossRent: number;
  totalVacancyAllowance: number;
  totalEffectiveRent: number;
  /** Units whose rampStartMonth is this month — i.e. newly added to the rent roll. */
  newUnitsThisMonth: string[];
}

export interface AnnualSummary {
  year: number;
  grossRentCollected: number;
  vacancyLoss: number;
  effectiveIncome: number;
  /** Count of units with no ramp remaining as of the last month of this year. */
  rampedInUnits: number;
}

export interface RentalWaterfallResult {
  unitMetrics: UnitMetrics[];
  cashFlowSeries: MonthlyCashFlow[];
  annualSummary: AnnualSummary[];
  totalEffectiveIncomeOver_N_Months: number;
  summary: string;
}
