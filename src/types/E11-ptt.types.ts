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

export interface PTTInput {
  purchasePrice: number;
  country: "Canada" | "US";
  province: string;
  isFTHB: boolean;
  /** Fair market value, used for FTHB eligibility — may differ from purchasePrice. */
  fmv: number;
  propertySize_hectares: number;
  hasSecondaryBuilding: boolean;
  isPrincipalResidence: boolean;
}

export interface PTTResult {
  /** Total PTT payable in dollars. null where no calculable PTT applies (US property, or a non-BC province). */
  ptt_amount: number | null;
  exemption_type: "full" | "partial" | "none";
  /** Human-readable description of how ptt_amount was derived. */
  breakdown: string;
  /** Dollar amount exempted from the general PTT. 0 when exemption_type is "none". */
  exemption_amount: number;
}
