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

import { SalePriceInput } from "./types";

/**
 * Calculate property sale price using either flat appreciation or cap rate method.
 *
 * flat_growth: salePrice = purchasePrice × (1 + rate)^years
 * cap_rate: salePrice = finalYearNOI / exitCapRate
 */
export function calculateSalePrice(input: SalePriceInput): number {
  if (input.method === "flat_growth") {
    return input.originalPurchasePrice * Math.pow(1 + input.appreciationRate, input.holdPeriodYears);
  }
  return input.finalYearNOI / input.exitCapRate;
}
