/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import {
  assessClimateRisk,
  ClimateRiskAssessmentRequest,
} from "../src/phase2-scaffolds-climate-risk";

describe("Phase 2 climate-risk contracts — interfaces only, not implemented", () => {
  it("ClimateRiskAssessmentRequest shape typechecks (compile-time proof the contract exists)", () => {
    const request: ClimateRiskAssessmentRequest = {
      address: "123 Main St",
      propertyType: "single_family",
      dataSource: "flood_zone_designation_only",
    };
    expect(request.dataSource).toBe("flood_zone_designation_only");
  });

  it("assessClimateRisk throws rather than fabricating a risk tier", () => {
    expect(() =>
      assessClimateRisk({
        address: "123 Main St",
        propertyType: "single_family",
        dataSource: "flood_zone_designation_only",
      })
    ).toThrow(/Phase 2 not implemented/);
  });
});
