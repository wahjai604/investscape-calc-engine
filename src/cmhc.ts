export interface CMHCPremiumInput {
  purchasePrice: number;
  downPaymentPercent: number;
  amortizationYears: number;
}

const EXTENDED_AMORTIZATION_SURCHARGE = 0.002;

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
