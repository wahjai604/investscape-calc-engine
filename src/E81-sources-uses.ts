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

import { calculateCapitalStack } from "./E8-capitalstack";
import { SourcesUsesInput, SourcesUsesResult, SourcesBreakdown, UsesBreakdown, SourcesUsesLineItem } from "./types";
import { SOURCES_USES_BALANCE_TOLERANCE } from "./utils/constants";

function buildSources(input: SourcesUsesInput): { sources: SourcesBreakdown; financingCostsFromFacilities: number } {
  const { facilities, sponsorEquityAmount } = input;

  // calculateCapitalStack() (E8, Prompt 1) is the single place
  // commitmentFeeAmount/netAdvance get computed from a facility's
  // amount/interestReserveAmount/commitmentFeePercent — reused here rather
  // than re-deriving that formula.
  const capitalStack = calculateCapitalStack(facilities.map(({ id, ...tranche }) => tranche));

  const facilityLineItems: SourcesUsesLineItem[] = facilities.map((facility, i) => ({
    label: facility.id,
    amount: capitalStack.tranches[i].amount,
  }));

  const facilitiesTotal = capitalStack.tranches.reduce((sum, t) => sum + t.amount, 0);
  const financingCostsFromFacilities = capitalStack.tranches.reduce(
    (sum, t) => sum + (t.interestReserveAmount ?? 0) + t.commitmentFeeAmount,
    0,
  );

  return {
    sources: {
      facilities: facilityLineItems,
      sponsorEquity: sponsorEquityAmount,
      total: facilitiesTotal + sponsorEquityAmount,
    },
    financingCostsFromFacilities,
  };
}

function buildUses(input: SourcesUsesInput, financingCostsFromFacilities: number): UsesBreakdown {
  const { landAcquisitionCost, hardCosts, softCosts, contingency } = input.uses;
  const financingCosts = input.uses.financingCosts ?? financingCostsFromFacilities;

  return {
    landAcquisitionCost,
    hardCosts,
    softCosts,
    financingCosts,
    contingency,
    total: landAcquisitionCost + hardCosts + softCosts + financingCosts + contingency,
  };
}

/**
 * Reconciles a development deal's Sources (financing facilities +
 * sponsor/LP equity) against its Uses (land, hard costs, soft costs,
 * financing costs, contingency). Ground-zero build — no "sources/uses"
 * concept existed anywhere in this engine before this.
 *
 * Deliberately does NOT round or force the two totals to match when they
 * don't: `balanced` is a real check against SOURCES_USES_BALANCE_TOLERANCE
 * (float-noise-sized, not a slush fund), and any real mismatch surfaces via
 * `delta` and `issues` for the caller to act on.
 */
export function calculateSourcesUses(input: SourcesUsesInput): SourcesUsesResult {
  const { sources, financingCostsFromFacilities } = buildSources(input);
  const uses = buildUses(input, financingCostsFromFacilities);

  const delta = sources.total - uses.total;
  const balanced = Math.abs(delta) <= SOURCES_USES_BALANCE_TOLERANCE;

  const issues: string[] = [];
  if (!balanced) {
    const direction = delta > 0 ? "exceed" : "fall short of";
    issues.push(
      `Sources (${sources.total.toFixed(2)}) ${direction} Uses (${uses.total.toFixed(2)}) by ${Math.abs(delta).toFixed(2)}.`,
    );
  }

  return { sources, uses, delta, balanced, issues };
}
