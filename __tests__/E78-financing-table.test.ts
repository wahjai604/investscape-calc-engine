/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateFinancingTable } from "../src/E78-financing-table";
import { trancheAmortizationSchedule } from "../src/E2-amortization";
import { FinancingFacility } from "../src/types";

// A 3-facility Development Studio deal: 1st mortgage (senior_debt) + 2nd
// mortgage (mezzanine) + a presale-deposit facility, combined over a
// 24-month timeline.
const senior: FinancingFacility = {
  id: "senior",
  type: "senior_debt",
  amount: 6000000,
  rate: 0.08,
  amortizationYears: 20,
  interestReserveAmount: 200000,
  commitmentFeePercent: 0.01,
};

const mezz: FinancingFacility = {
  id: "mezz",
  type: "mezzanine",
  amount: 1500000,
  rate: 0.12,
  amortizationYears: 20,
  interestReserveAmount: 50000,
  commitmentFeePercent: 0.02,
};

// Milestones release 30% from month 1, 70% cumulative from month 7, 100%
// cumulative from month 13 (inclusive). presale_deposit facilities accrue
// no interest (trust-held buyer earnest money, not developer debt), so
// unlike senior/mezzanine, rate here is carried on the tranche but never
// factored into interestAccrued/reserve math.
const presale: FinancingFacility = {
  id: "presale",
  type: "presale_deposit",
  amount: 1000000,
  rate: 0.01,
  milestones: [
    { month: 1, cumulativeReleasePercent: 0.3 },
    { month: 7, cumulativeReleasePercent: 0.7 },
    { month: 13, cumulativeReleasePercent: 1.0 },
  ],
  interestReserveAmount: 12000,
  commitmentFeePercent: 0.005,
};

const facilities = [senior, mezz, presale];
const months = 24;

describe("calculateFinancingTable", () => {
  const result = calculateFinancingTable({ facilities, months });

  it("reconciles total sources: capitalStack.totalCapital equals the sum of facility amounts, which equals net advances plus reserves plus fees", () => {
    expect(result.capitalStack.totalCapital).toBeCloseTo(8500000, 2);

    const sumOfAmounts = facilities.reduce((sum, f) => sum + f.amount, 0);
    expect(sumOfAmounts).toBeCloseTo(8500000, 2);

    const sumOfNetAdvances = result.facilities.reduce((sum, f) => sum + f.netAdvance, 0);
    const sumOfReservesAndFees = result.facilities.reduce(
      (sum, f) => sum + f.interestReserveAmount + f.commitmentFeeAmount,
      0,
    );
    expect(sumOfNetAdvances + sumOfReservesAndFees).toBeCloseTo(result.capitalStack.totalCapital, 2);
  });

  it("computes each facility's commitmentFeeAmount and netAdvance from its own amount/reserve/fee inputs", () => {
    const [seniorSummary, mezzSummary, presaleSummary] = result.facilities;

    expect(seniorSummary.commitmentFeeAmount).toBeCloseTo(60000, 2);
    expect(seniorSummary.netAdvance).toBeCloseTo(5740000, 2);

    expect(mezzSummary.commitmentFeeAmount).toBeCloseTo(30000, 2);
    expect(mezzSummary.netAdvance).toBeCloseTo(1420000, 2);

    expect(presaleSummary.commitmentFeeAmount).toBeCloseTo(5000, 2);
    expect(presaleSummary.netAdvance).toBeCloseTo(983000, 2);
  });

  it("never depletes the presale facility's interest reserve: presale_deposit accrues no interest, so reserveBalance sits at the full reserve amount for the whole schedule", () => {
    const presaleSummary = result.facilities.find((f) => f.id === "presale")!;
    const reserveSchedule = presaleSummary.interestReserveSchedule;

    expect(reserveSchedule.every((r) => r.interestAccrued === 0)).toBe(true);
    expect(reserveSchedule.every((r) => r.reserveBalance === presaleSummary.interestReserveAmount)).toBe(true);
    expect(reserveSchedule.every((r) => r.reserveDepleted === false)).toBe(true);
  });

  it("scopes the no-interest fix to presale_deposit only: senior_debt in the same table still accrues real interest and depletes its reserve", () => {
    const seniorSummary = result.facilities.find((f) => f.id === "senior")!;
    const reserveSchedule = seniorSummary.interestReserveSchedule;

    expect(reserveSchedule.some((r) => r.interestAccrued > 0)).toBe(true);
    expect(reserveSchedule.some((r) => r.reserveDepleted)).toBe(true);
  });

  it("reserve balances are monotonically non-increasing for every facility (a reserve never refills)", () => {
    for (const facility of result.facilities) {
      const schedule = facility.interestReserveSchedule;
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].reserveBalance).toBeLessThanOrEqual(schedule[i - 1].reserveBalance);
      }
    }
  });

  it("the presale-deposit facility never amortizes like a loan: its balance only steps up on milestones and never declines", () => {
    const presaleBalances = result.combinedSeries.map((row) => row.balancesByFacility["presale"]);

    // Step function driven by milestones, not a declining loan balance.
    expect(presaleBalances.slice(0, 6).every((b) => b === 300000)).toBe(true);
    expect(presaleBalances.slice(6, 12).every((b) => b === 700000)).toBe(true);
    expect(presaleBalances.slice(12, 24).every((b) => b === 1000000)).toBe(true);

    for (let i = 1; i < presaleBalances.length; i++) {
      expect(presaleBalances[i]).toBeGreaterThanOrEqual(presaleBalances[i - 1]);
    }
  });

  it("senior_debt and mezzanine facilities, by contrast, amortize: their balances strictly decrease every period", () => {
    const seniorBalances = result.combinedSeries.map((row) => row.balancesByFacility["senior"]);
    const mezzBalances = result.combinedSeries.map((row) => row.balancesByFacility["mezz"]);

    for (let i = 1; i < seniorBalances.length; i++) {
      expect(seniorBalances[i]).toBeLessThan(seniorBalances[i - 1]);
    }
    for (let i = 1; i < mezzBalances.length; i++) {
      expect(mezzBalances[i]).toBeLessThan(mezzBalances[i - 1]);
    }
  });

  it("combinedSeries.totalOutstanding at each period sums that period's per-facility balances", () => {
    for (const row of result.combinedSeries) {
      const sum = Object.values(row.balancesByFacility).reduce((s, b) => s + b, 0);
      expect(row.totalOutstanding).toBeCloseTo(sum, 6);
    }
    expect(result.combinedSeries).toHaveLength(months);
  });
});

// A delayed-draw mezzanine: senior draws day 1 (drawMonth omitted/0) and
// amortizes over 25yr; mezzanine draws at month 6 and amortizes over its own
// 15yr term from that point; equity has no schedule and is unaffected by
// drawMonth entirely. Confirms E78's facilityPeriods()/combinedSeries wiring
// (which indexes trancheAmortizationSchedule()'s rows by rows[period - 1])
// still lines up correctly once a facility's rows lead with zero-balance
// pre-draw periods.
describe("calculateFinancingTable with a delayed-draw (drawMonth) mezzanine", () => {
  const seniorDrawDay1: FinancingFacility = {
    id: "senior",
    type: "senior_debt",
    amount: 6000000,
    rate: 0.08,
    amortizationYears: 25,
  };

  const delayedMezz: FinancingFacility = {
    id: "mezz",
    type: "mezzanine",
    amount: 1500000,
    rate: 0.12,
    amortizationYears: 15,
    drawMonth: 6,
  };

  const equity: FinancingFacility = {
    id: "equity",
    type: "equity",
    amount: 2000000,
    rate: 0,
  };

  const delayedFacilities = [seniorDrawDay1, delayedMezz, equity];
  const delayedResult = calculateFinancingTable({ facilities: delayedFacilities, months: 24 });

  it("mezzanine's balancesByFacility sits at $0 for periods 1-6, then steps up to its drawn amount (net of period 7's own paydown) at period 7", () => {
    const mezzBalances = delayedResult.combinedSeries.map((row) => row.balancesByFacility["mezz"]);

    for (let period = 1; period <= 6; period++) {
      expect(mezzBalances[period - 1]).toBe(0);
    }

    // combinedSeries stores each period's *ending* balance, so period 7 is
    // net of that period's own principal paydown — compare against the
    // tranche's own schedule rather than the raw draw amount.
    const mezzRows = trancheAmortizationSchedule(delayedMezz, "monthly");
    const period7Row = mezzRows.find((row) => row.period === 7)!;
    expect(period7Row.beginningBalance).toBeCloseTo(1500000, 2);
    expect(mezzBalances[6]).toBeCloseTo(period7Row.endingBalance, 2);
  });

  it("equity carries no balance entry in combinedSeries regardless of drawMonth on other facilities", () => {
    for (const row of delayedResult.combinedSeries) {
      expect(row.balancesByFacility["equity"]).toBeUndefined();
    }
  });

  it("totalOutstanding sums correctly both before (period 5) and after (period 10) the mezzanine's draw", () => {
    const period5 = delayedResult.combinedSeries.find((r) => r.period === 5)!;
    const period10 = delayedResult.combinedSeries.find((r) => r.period === 10)!;

    expect(period5.totalOutstanding).toBeCloseTo(period5.balancesByFacility["senior"], 6);
    expect(period10.totalOutstanding).toBeCloseTo(
      period10.balancesByFacility["senior"] + period10.balancesByFacility["mezz"],
      6,
    );
  });

  it("a presale_deposit facility run through the same calculateFinancingTable() call is completely unaffected by the drawMonth change (proves that code path wasn't touched)", () => {
    const presaleAlongsideDelayedMezz: FinancingFacility = {
      id: "presale",
      type: "presale_deposit",
      amount: 1000000,
      rate: 0.01,
      milestones: [
        { month: 1, cumulativeReleasePercent: 0.3 },
        { month: 7, cumulativeReleasePercent: 0.7 },
        { month: 13, cumulativeReleasePercent: 1.0 },
      ],
    };

    const withMezzResult = calculateFinancingTable({
      facilities: [presaleAlongsideDelayedMezz, delayedMezz],
      months: 24,
    });
    const withoutMezzResult = calculateFinancingTable({
      facilities: [presaleAlongsideDelayedMezz],
      months: 24,
    });

    const presaleBalancesWith = withMezzResult.combinedSeries.map((row) => row.balancesByFacility["presale"]);
    const presaleBalancesWithout = withoutMezzResult.combinedSeries.map((row) => row.balancesByFacility["presale"]);

    expect(presaleBalancesWith).toEqual(presaleBalancesWithout);
  });
});

// A 3-facility deal where senior and mezzanine both use the construction-loan
// interest_only_bullet mechanic, but with genuinely different bullet months
// (24mo construction + senior's own 6mo sell-off vs. mezzanine's own 4mo
// sell-off) — confirms each facility's bullet timing is independent, not a
// shared/hardcoded value. Equity carries no schedule and is unaffected.
describe("calculateFinancingTable with interest_only_bullet senior + mezzanine on different bullet months", () => {
  const seniorBullet: FinancingFacility = {
    id: "senior",
    type: "senior_debt",
    amount: 6000000,
    rate: 0.08,
    repaymentType: "interest_only_bullet",
    drawMonth: 0,
    bulletRepaymentMonth: 30,
  };

  const mezzBullet: FinancingFacility = {
    id: "mezz",
    type: "mezzanine",
    amount: 1500000,
    rate: 0.12,
    repaymentType: "interest_only_bullet",
    drawMonth: 6,
    bulletRepaymentMonth: 28,
  };

  const equity: FinancingFacility = {
    id: "equity",
    type: "equity",
    amount: 2000000,
    rate: 0,
  };

  const bulletFacilities = [seniorBullet, mezzBullet, equity];
  const months = 30;
  const bulletResult = calculateFinancingTable({ facilities: bulletFacilities, months });

  it("mezzanine hits exactly $0 at period 28 while senior is still outstanding", () => {
    const period28 = bulletResult.combinedSeries.find((r) => r.period === 28)!;
    expect(period28.balancesByFacility["mezz"]).toBe(0);
    expect(period28.balancesByFacility["senior"]).toBeCloseTo(6000000, 2);
  });

  it("mezzanine is still outstanding (flat, interest-only) the period before its own bullet", () => {
    const period27 = bulletResult.combinedSeries.find((r) => r.period === 27)!;
    expect(period27.balancesByFacility["mezz"]).toBeCloseTo(1500000, 2);
  });

  it("senior hits exactly $0 at period 30, its own (later) bullet month", () => {
    const period30 = bulletResult.combinedSeries.find((r) => r.period === 30)!;
    expect(period30.balancesByFacility["senior"]).toBe(0);
    expect(period30.balancesByFacility["mezz"]).toBe(0);
  });

  it("senior is still outstanding (flat, interest-only) the period before its own bullet", () => {
    const period29 = bulletResult.combinedSeries.find((r) => r.period === 29)!;
    expect(period29.balancesByFacility["senior"]).toBeCloseTo(6000000, 2);
  });

  it("totalOutstanding reflects both independent bullet transitions correctly at each point", () => {
    const period27 = bulletResult.combinedSeries.find((r) => r.period === 27)!;
    const period28 = bulletResult.combinedSeries.find((r) => r.period === 28)!;
    const period29 = bulletResult.combinedSeries.find((r) => r.period === 29)!;
    const period30 = bulletResult.combinedSeries.find((r) => r.period === 30)!;

    expect(period27.totalOutstanding).toBeCloseTo(6000000 + 1500000, 2);
    expect(period28.totalOutstanding).toBeCloseTo(6000000, 2);
    expect(period29.totalOutstanding).toBeCloseTo(6000000, 2);
    expect(period30.totalOutstanding).toBe(0);
  });

  it("equity carries no balance entry regardless of the bullet mechanic on the other facilities", () => {
    for (const row of bulletResult.combinedSeries) {
      expect(row.balancesByFacility["equity"]).toBeUndefined();
    }
  });
});
