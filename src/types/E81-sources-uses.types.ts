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

import { FinancingFacility } from "./E78-financing-table.types";

export interface SourcesUsesUsesInput {
  landAcquisitionCost: number;
  hardCosts: number;
  softCosts: number;
  contingency: number;
  /**
   * Optional — when omitted, financing costs are derived from `facilities`
   * (Σ interestReserveAmount + Σ commitmentFeeAmount, via
   * calculateCapitalStack() from E8-capitalstack.ts, the same computation
   * E78-financing-table.ts's per-facility summaries already use) so
   * callers don't have to duplicate that math. Supply this explicitly only
   * when the financing-table integration (E78) isn't available to a given
   * caller yet.
   */
  financingCosts?: number;
}

export interface SourcesUsesInput {
  uses: SourcesUsesUsesInput;
  /**
   * Reuses E78-financing-table.ts's FinancingFacility (a Tranche + id) —
   * each facility's own `amount` is its Sources contribution, and
   * interestReserveAmount/commitmentFeePercent drive the Uses-side
   * "financing costs" figure when uses.financingCosts is omitted. If the
   * E78 integration hasn't landed in a given caller yet, pass `[]` here and
   * set uses.financingCosts explicitly instead — that's the flagged
   * integration point for a later pass, not a silent gap.
   */
  facilities: FinancingFacility[];
  /**
   * LP/sponsor equity not already represented as an "equity"-type facility
   * in `facilities`. Added on top of whatever `facilities` contribute —
   * not a duplicate of any equity-type facility's amount, so don't model
   * the same equity check both ways.
   */
  sponsorEquityAmount: number;
}

export interface SourcesUsesLineItem {
  label: string;
  amount: number;
}

export interface SourcesBreakdown {
  facilities: SourcesUsesLineItem[];
  sponsorEquity: number;
  total: number;
}

export interface UsesBreakdown {
  landAcquisitionCost: number;
  hardCosts: number;
  softCosts: number;
  financingCosts: number;
  contingency: number;
  total: number;
}

export interface SourcesUsesResult {
  sources: SourcesBreakdown;
  uses: UsesBreakdown;
  /** sources.total - uses.total. 0 (within SOURCES_USES_BALANCE_TOLERANCE) when balanced; never rounded or forced to 0 otherwise. */
  delta: number;
  /** True only when |delta| is within SOURCES_USES_BALANCE_TOLERANCE — a real reconciliation check, not a display rounding. */
  balanced: boolean;
  /** Empty when balanced. Otherwise names the exact shortfall/surplus and its direction — never silently absorbed into either total. */
  issues: string[];
}
