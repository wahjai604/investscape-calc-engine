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

import { CMHCPremiumInput } from "./types";
import { EXTENDED_AMORTIZATION_SURCHARGE } from "./utils/constants";

/**
 * CMHC only insures mortgages with LTV in (80%, 95%]; below 80% no
 * insurance is required, and above 95% the loan isn't insurable.
 */
function premiumRateForLTV(ltvPercent: number): number {
  if (ltvPercent > 90 && ltvPercent <= 95) return 0.04;
  if (ltvPercent > 85 && ltvPercent <= 90) return 0.031;
  if (ltvPercent > 80 && ltvPercent <= 85) return 0.028;

  throw new Error(`No CMHC premium band defined for LTV of ${ltvPercent}%`);
}

export function calculateCMHCPremium(input: CMHCPremiumInput): number {
  const { purchasePrice, downPaymentPercent, amortizationYears } = input;

  const principal = purchasePrice * (1 - downPaymentPercent);
  const ltvPercent = (1 - downPaymentPercent) * 100;

  let rate = premiumRateForLTV(ltvPercent);
  if (amortizationYears > 25) {
    rate += EXTENDED_AMORTIZATION_SURCHARGE;
  }

  return principal * rate;
}
