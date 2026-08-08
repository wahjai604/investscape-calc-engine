import { RentalUnit, RentalWaterfallInput, UnitMetrics, MonthlyCashFlow, AnnualSummary, RentalWaterfallResult } from "./types";

interface UnitMonthFigures {
  grossRent: number;
  vacancyLoss: number;
  effectiveRent: number;
  isNewThisMonth: boolean;
  isFullyRamped: boolean;
}

/**
 * "Gross" is the unit's full monthlyRent whenever it's on the rent roll at
 * all (ramping or stabilized); before rampStartMonth it isn't yet
 * inventory, so every figure is $0 — there's no rent being foregone on a
 * unit that doesn't exist as available space yet.
 *
 * "Vacancy loss" folds in both causes of a shortfall against that gross
 * figure: the ramp-period occupancy shortfall (monthlyRent × (1 -
 * occupancyDuringRamp)) and ordinary stabilized-period vacancy
 * (monthlyRent × vacancyRatePercent). The source spec's own per-branch
 * formula computes the NET (post-vacancy) figure directly in each branch;
 * this treats that as effectiveRent and derives vacancyLoss as
 * (grossRent - effectiveRent), which is what reconciles a single
 * per-branch net formula with cashFlowSeries needing three distinct
 * totals (gross / vacancy / effective), not just the one net number.
 */
function figuresForUnitAtMonth(unit: RentalUnit, month: number): UnitMonthFigures {
  if (month < unit.rampStartMonth) {
    return { grossRent: 0, vacancyLoss: 0, effectiveRent: 0, isNewThisMonth: false, isFullyRamped: false };
  }

  const isRamping = unit.rampEndMonth !== null && month < unit.rampEndMonth;
  const grossRent = unit.monthlyRent;
  const effectiveRent = isRamping
    ? unit.monthlyRent * unit.occupancyDuringRamp
    : unit.monthlyRent * (1 - unit.vacancyRatePercent);

  return {
    grossRent,
    vacancyLoss: grossRent - effectiveRent,
    effectiveRent,
    // Math.max(rampStartMonth, 1): the monthly loop only iterates months
    // 1..analysisMonths (there's no month-0 row), so a unit available "from
    // day 1" (rampStartMonth === 0) needs its first real month (1) flagged
    // as new — checking month === rampStartMonth directly would compare
    // against 0 and never match, silently omitting that unit from every
    // month's newUnitsThisMonth.
    isNewThisMonth: month === Math.max(unit.rampStartMonth, 1),
    isFullyRamped: !isRamping,
  };
}

function buildCashFlowSeries(input: RentalWaterfallInput): MonthlyCashFlow[] {
  const series: MonthlyCashFlow[] = [];

  for (let month = 1; month <= input.analysisMonths; month++) {
    let totalGrossRent = 0;
    let totalVacancyAllowance = 0;
    let totalEffectiveRent = 0;
    const newUnitsThisMonth: string[] = [];

    for (const unit of input.units) {
      const figures = figuresForUnitAtMonth(unit, month);
      totalGrossRent += figures.grossRent;
      totalVacancyAllowance += figures.vacancyLoss;
      totalEffectiveRent += figures.effectiveRent;
      if (figures.isNewThisMonth) newUnitsThisMonth.push(unit.unitId);
    }

    series.push({ month, totalGrossRent, totalVacancyAllowance, totalEffectiveRent, newUnitsThisMonth });
  }

  return series;
}

function rampImpactText(unit: RentalUnit): string {
  if (unit.rampEndMonth === null) {
    return `No ramp — immediate occupancy from month ${unit.rampStartMonth}.`;
  }
  // rampEndMonth is exclusive in figuresForUnitAtMonth's branch condition
  // (rampStartMonth <= month < rampEndMonth), so the last actual ramp
  // month is rampEndMonth - 1.
  const lastRampMonth = unit.rampEndMonth - 1;
  return `Ramps months ${unit.rampStartMonth}-${lastRampMonth} at ${(unit.occupancyDuringRamp * 100).toFixed(0)}% occupancy.`;
}

function buildUnitMetrics(units: RentalUnit[]): UnitMetrics[] {
  return units.map((unit) => {
    const annualStabilizedRent = unit.monthlyRent * 12;
    const annualVacancyAllowance = annualStabilizedRent * unit.vacancyRatePercent;

    return {
      unitId: unit.unitId,
      stabilizedMonthlyRent: unit.monthlyRent,
      annualStabilizedRent,
      annualVacancyAllowance,
      annualEffectiveRent: annualStabilizedRent - annualVacancyAllowance,
      rampImpact: rampImpactText(unit),
    };
  });
}

function buildAnnualSummary(input: RentalWaterfallInput, cashFlowSeries: MonthlyCashFlow[]): AnnualSummary[] {
  const yearsCount = Math.ceil(input.analysisMonths / 12);
  const summary: AnnualSummary[] = [];

  for (let year = 1; year <= yearsCount; year++) {
    const startMonth = (year - 1) * 12 + 1;
    const endMonth = Math.min(year * 12, input.analysisMonths);
    const monthsInYear = cashFlowSeries.filter((row) => row.month >= startMonth && row.month <= endMonth);

    const grossRentCollected = monthsInYear.reduce((sum, row) => sum + row.totalGrossRent, 0);
    const vacancyLoss = monthsInYear.reduce((sum, row) => sum + row.totalVacancyAllowance, 0);
    const effectiveIncome = monthsInYear.reduce((sum, row) => sum + row.totalEffectiveRent, 0);
    const rampedInUnits = input.units.filter((unit) => figuresForUnitAtMonth(unit, endMonth).isFullyRamped).length;

    summary.push({ year, grossRentCollected, vacancyLoss, effectiveIncome, rampedInUnits });
  }

  return summary;
}

function buildSummary(units: RentalUnit[], unitMetrics: UnitMetrics[], annualSummary: AnnualSummary[]): string {
  const stabilizedGrossAnnual = unitMetrics.reduce((sum, u) => sum + u.annualStabilizedRent, 0);
  const firstYear = annualSummary[0];
  const lastYear = annualSummary[annualSummary.length - 1];

  const firstYearLabel = firstYear.rampedInUnits === units.length ? "stabilized" : "ramping";
  const lastYearLabel = lastYear.rampedInUnits === units.length ? "stabilized" : "ramping";

  return (
    `${units.length} unit${units.length === 1 ? "" : "s"}, stabilized gross $${stabilizedGrossAnnual.toFixed(2)}. ` +
    `Year 1: $${firstYear.effectiveIncome.toFixed(2)} (${firstYearLabel}). ` +
    `Year ${lastYear.year}: $${lastYear.effectiveIncome.toFixed(2)} (${lastYearLabel}).`
  );
}

export function calculateRentalWaterfall(input: RentalWaterfallInput): RentalWaterfallResult {
  const unitMetrics = buildUnitMetrics(input.units);
  const cashFlowSeries = buildCashFlowSeries(input);
  const annualSummary = buildAnnualSummary(input, cashFlowSeries);
  const totalEffectiveIncomeOver_N_Months = cashFlowSeries.reduce((sum, row) => sum + row.totalEffectiveRent, 0);
  const summary = buildSummary(input.units, unitMetrics, annualSummary);

  return { unitMetrics, cashFlowSeries, annualSummary, totalEffectiveIncomeOver_N_Months, summary };
}
