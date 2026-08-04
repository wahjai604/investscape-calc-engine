import { calculateBCPTT, calculateUSPTT, calculatePTT, PTTInput } from "../src/ptt";

describe("calculateBCPTT — general (non-FTHB) scenarios", () => {
  it("$550K (Template v2, investor, no FTHB) → $9,000 PTT", () => {
    const result = calculateBCPTT(550000, false, 550000, 0.3, false, false);
    expect(result.ptt_amount).toBe(9000);
    expect(result.exemption_type).toBe("none");
    expect(result.exemption_amount).toBe(0);
  });

  it("$200K → $2,000 (1% bracket only)", () => {
    const result = calculateBCPTT(200000, false, 200000, 0.3, false, false);
    expect(result.ptt_amount).toBe(2000);
    expect(result.exemption_type).toBe("none");
  });

  it("$2M → $2,000 + $36,000 = $38,000 (crosses into the 2% bracket)", () => {
    const result = calculateBCPTT(2000000, false, 2000000, 0.3, false, false);
    expect(result.ptt_amount).toBe(38000);
  });

  it("residential property over $3,000,000 includes the additional 2% surcharge", () => {
    // The surcharge applies to the portion strictly "over" $3,000,000 (per E12's
    // spec wording), so a price of exactly $3,000,000 has a $0 surcharge portion
    // (see the boundary test below). $3,500,000 exercises the surcharge
    // unambiguously: 1%*200k + 2%*1.8M + 3%*1.5M + 2%*500k = 2,000 + 36,000 + 45,000 + 10,000 = 93,000.
    const result = calculateBCPTT(3500000, false, 3500000, 0.3, false, false);
    expect(result.ptt_amount).toBe(93000);
    expect(result.breakdown).toContain("residential surcharge");

    // Confirms the surcharge is genuinely additive: without it, the property would owe $83,000.
    const withoutSurcharge = 2000 + 36000 + 0.03 * (3500000 - 2000000);
    expect(result.ptt_amount).toBe(withoutSurcharge + 0.02 * (3500000 - 3000000));
  });

  it("exactly $3,000,000 does NOT trigger the surcharge (threshold is 'over', not 'at')", () => {
    const result = calculateBCPTT(3000000, false, 3000000, 0.3, false, false);
    expect(result.ptt_amount).toBe(68000);
    expect(result.breakdown).not.toContain("surcharge");
  });
});

describe("calculateBCPTT — FTHB full exemption", () => {
  it("$500K, FTHB eligible, FMV=$500K, size=0.3ha, principal residence → $0 PTT", () => {
    const result = calculateBCPTT(500000, true, 500000, 0.3, false, true);
    expect(result.ptt_amount).toBe(0);
    expect(result.exemption_type).toBe("full");
    expect(result.exemption_amount).toBe(8000);
  });

  it("$400K, FTHB eligible → $0 PTT (entire price is under the $500K exemption threshold)", () => {
    const result = calculateBCPTT(400000, true, 400000, 0.3, false, true);
    expect(result.ptt_amount).toBe(0);
    expect(result.exemption_type).toBe("full");
    expect(result.exemption_amount).toBe(6000);
  });

  it("$835K, FTHB eligible, FMV=$835K (at the full-exemption FMV threshold) → still 'full' exemption type, but only the first $500K is tax-free", () => {
    // The full exemption only ever covers tax on the first $500,000 of purchase
    // price (per E12 §5) — it doesn't zero out PTT on prices above that, even
    // when FMV sits right at the $835K full-eligibility ceiling. At $835K,
    // exemption_amount is capped at the max $8,000, leaving $6,700 payable on
    // the portion above $500K.
    const result = calculateBCPTT(835000, true, 835000, 0.3, false, true);
    expect(result.exemption_type).toBe("full");
    expect(result.exemption_amount).toBe(8000);
    expect(result.ptt_amount).toBe(6700);
  });
});

describe("calculateBCPTT — FTHB partial exemption (FMV phase-out band $835K–$860K)", () => {
  it("$850K, FTHB, FMV=$850K → partial exemption (40% of the full exemption remains, i.e. 60% phased out)", () => {
    // proportion = (860,000 - 850,000) / 25,000 = 0.4
    const result = calculateBCPTT(850000, true, 850000, 0.3, false, true);
    expect(result.exemption_type).toBe("partial");
    expect(result.exemption_amount).toBeCloseTo(3200, 2);
    expect(result.ptt_amount).toBeCloseTo(11800, 2);
  });

  it("$847.5K (exact midpoint of the phase-out band) → 50% phase-out", () => {
    const result = calculateBCPTT(847500, true, 847500, 0.3, false, true);
    expect(result.exemption_type).toBe("partial");
    expect(result.exemption_amount).toBeCloseTo(4000, 2);
    expect(result.ptt_amount).toBeCloseTo(10950, 2);
  });

  it("$860K → 0% exemption (at the phase-out ceiling, exemption_type becomes 'none')", () => {
    const result = calculateBCPTT(860000, true, 860000, 0.3, false, true);
    expect(result.exemption_type).toBe("none");
    expect(result.exemption_amount).toBe(0);
    expect(result.ptt_amount).toBe(15200);
  });
});

describe("calculateBCPTT — FTHB downgraded to partial (secondary building / oversized lot, FMV ≤ $835K)", () => {
  it("$600K, FTHB, hasSecondaryBuilding=true, FMV=$600K → partial exemption (FMV-in-range means 100% of the exemption still applies, just relabeled 'partial')", () => {
    const result = calculateBCPTT(600000, true, 600000, 0.3, true, true);
    expect(result.exemption_type).toBe("partial");
    expect(result.exemption_amount).toBe(8000);
    expect(result.ptt_amount).toBe(2000);
    expect(result.breakdown).toContain("secondary building");
  });

  it("$600K, FTHB, propertySize_hectares=0.6 (over the 0.5ha limit), FMV=$600K → partial exemption", () => {
    const result = calculateBCPTT(600000, true, 600000, 0.6, false, true);
    expect(result.exemption_type).toBe("partial");
    expect(result.exemption_amount).toBe(8000);
    expect(result.ptt_amount).toBe(2000);
    expect(result.breakdown).toContain("0.5 hectares");
  });

  it("disqualification still routes through the FMV phase-out ratio: an oversized lot with FMV in the $835K-$860K band gets both effects", () => {
    const result = calculateBCPTT(700000, true, 850000, 0.6, false, true);
    expect(result.exemption_type).toBe("partial");
    // Same 40% proportion as the plain FMV-band case, applied to this purchase price's own maxExemption.
    expect(result.exemption_amount).toBeCloseTo(8000 * 0.4, 2);
  });
});

describe("calculateUSPTT", () => {
  it("returns ptt_amount: null with the required message", () => {
    const result = calculateUSPTT();
    expect(result.ptt_amount).toBeNull();
    expect(result.breakdown).toBe("US has no federal PTT");
  });
});

describe("calculatePTT — dispatch", () => {
  const basePTTInput: PTTInput = {
    purchasePrice: 550000,
    country: "Canada",
    province: "BC",
    isFTHB: false,
    fmv: 550000,
    propertySize_hectares: 0.3,
    hasSecondaryBuilding: false,
    isPrincipalResidence: false,
  };

  it("US property → ptt_amount: null", () => {
    const result = calculatePTT({ ...basePTTInput, country: "US" });
    expect(result.ptt_amount).toBeNull();
    expect(result.breakdown).toBe("US has no federal PTT");
  });

  it.each(["AB", "ON"])("other province (%s) → ptt_amount: null", (province) => {
    const result = calculatePTT({ ...basePTTInput, province });
    expect(result.ptt_amount).toBeNull();
    expect(result.breakdown).toBe("Provincial PTT varies by province");
  });

  it("province matching is case-insensitive", () => {
    const result = calculatePTT({ ...basePTTInput, province: "bc" });
    expect(result.ptt_amount).toBe(9000);
  });

  it("BC → routes to calculateBCPTT with the input's fields", () => {
    const result = calculatePTT(basePTTInput);
    const expected = calculateBCPTT(
      basePTTInput.purchasePrice,
      basePTTInput.isFTHB,
      basePTTInput.fmv,
      basePTTInput.propertySize_hectares,
      basePTTInput.hasSecondaryBuilding,
      basePTTInput.isPrincipalResidence,
    );
    expect(result).toEqual(expected);
    expect(result.ptt_amount).toBe(9000);
  });

  it("BC FTHB case dispatches through to the full exemption path", () => {
    const fthbInput: PTTInput = {
      ...basePTTInput,
      purchasePrice: 500000,
      isFTHB: true,
      fmv: 500000,
      isPrincipalResidence: true,
    };
    const result = calculatePTT(fthbInput);
    expect(result.exemption_type).toBe("full");
    expect(result.ptt_amount).toBe(0);
  });
});
