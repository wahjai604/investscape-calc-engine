import { AppreciationInput, AppreciationResult } from "./types";

/**
 * downPaymentPercent and closingCostsPercent are accepted on the input for
 * consistency with the rest of the deal shape but aren't used by any
 * formula here — appreciation is purely a function of purchasePrice,
 * annualAppreciationRate, and holdPeriodYears (compounded annually), and
 * projected equity is a function of the projected sale price and the loan
 * balance the caller supplies. initialEquity IS used, but only in the
 * breakdown narrative, as the baseline the projected equity is measured
 * against.
 */
export function calculateAppreciation(input: AppreciationInput): AppreciationResult {
  const { purchasePrice, initialEquity, holdPeriodYears, annualAppreciationRate, remainingLoanBalance } = input;

  const projectedSalePrice = purchasePrice * Math.pow(1 + annualAppreciationRate, holdPeriodYears);
  const totalAppreciation = projectedSalePrice - purchasePrice;
  const appreciationPercent = (totalAppreciation / purchasePrice) * 100;
  const projectedEquity = projectedSalePrice - remainingLoanBalance;
  const equityGain = projectedEquity - initialEquity;

  const breakdown =
    `At ${(annualAppreciationRate * 100).toFixed(2)}% annual appreciation over ${holdPeriodYears} year${holdPeriodYears === 1 ? "" : "s"}, ` +
    `the property is projected to grow from $${purchasePrice.toLocaleString()} to $${projectedSalePrice.toFixed(2)} ` +
    `(+$${totalAppreciation.toFixed(2)}, ${appreciationPercent.toFixed(2)}%). ` +
    `After paying off the projected remaining loan balance of $${remainingLoanBalance.toFixed(2)}, projected equity is ` +
    `$${projectedEquity.toFixed(2)} — a gain of $${equityGain.toFixed(2)} over the $${initialEquity.toLocaleString()} initially invested.`;

  return {
    purchasePrice,
    projectedSalePrice,
    totalAppreciation,
    appreciationPercent,
    annualizedAppreciationRate: annualAppreciationRate,
    projectedEquity,
    breakdown,
  };
}
