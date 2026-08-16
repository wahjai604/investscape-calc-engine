/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { projectSTRRevenue, STRRevenueProjectionRequest } from "../src/phase2-scaffolds-str";

describe("Phase 2 STR contracts — interfaces only, not implemented", () => {
  it("STRRevenueProjectionRequest shape typechecks (compile-time proof the contract exists)", () => {
    const request: STRRevenueProjectionRequest = {
      address: "123 Main St",
      bedrooms: 3,
      propertyType: "single_family",
      dataSource: "third_party_projection",
    };
    expect(request.bedrooms).toBe(3);
  });

  it("projectSTRRevenue throws rather than fabricating a revenue projection", () => {
    expect(() =>
      projectSTRRevenue({
        address: "123 Main St",
        bedrooms: 3,
        propertyType: "single_family",
        dataSource: "third_party_projection",
      })
    ).toThrow(/Phase 2 not implemented/);
  });
});
