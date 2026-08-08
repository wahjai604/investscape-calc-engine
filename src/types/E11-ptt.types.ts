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
