/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateFinancingTable } from "../src/E78-financing-table";
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

// rate 1%/yr => monthlyRate = 1/1200. Milestones release 30% from month 1,
// 70% cumulative from month 7, 100% cumulative from month 13 (inclusive) —
// hand-computed cumulative interest: months 1-6 @ $300,000 drawn =
// $250.00/mo (=$1,500 total); months 7-12 @ $700,000 drawn = $583.33/mo
// (=$3,500 total, running $5,000); months 13-24 @ $1,000,000 drawn =
// $833.33/mo. A $12,000 reserve is exhausted 7,000/833.33 = 8.4 months into
// that final stretch, i.e. during period 21 (cumulative interest crosses
// $12,000 between periods 20 and 21).
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

  it("depletes the presale facility's interest reserve correctly: still positive at period 20, exhausted by period 21", () => {
    const presaleSummary = result.facilities.find((f) => f.id === "presale")!;
    const reserveSchedule = presaleSummary.interestReserveSchedule;

    const period20 = reserveSchedule.find((r) => r.period === 20)!;
    const period21 = reserveSchedule.find((r) => r.period === 21)!;

    expect(period20.reserveBalance).toBeCloseTo(333.33, 1);
    expect(period20.reserveDepleted).toBe(false);

    expect(period21.reserveBalance).toBe(0);
    expect(period21.reserveDepleted).toBe(true);

    // Once depleted, stays depleted for the rest of the schedule.
    expect(reserveSchedule.slice(20).every((r) => r.reserveDepleted)).toBe(true);
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
