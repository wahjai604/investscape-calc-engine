import type { PortfolioRollup } from "../../../src/types";

/**
 * Shape of one row from the query in query.ts: properties owned by the
 * caller, joined to their 'Owned' deal's deal_inputs/deal_metrics (Doc 02
 * §properties/deals/deal_inputs/deal_metrics). Only the columns that exist
 * in the real schema today are listed here — see the README note in
 * handler.ts for what's structurally missing (rent/expense growth rate,
 * exit value) and why cashFlowSeries can never be built from this row alone
 * yet.
 */
export interface OwnedPropertyRow {
  id: string;
  address: string | null;
  acquisition_date: string | null;
  hold_period_assumption_years: number | null;
  appreciation_assumption_pct_annual: number | null;
  deal: {
    id: string;
    purchase_price: number | null;
    initial_cash_invested: number | null;
    cash_flow_annual: number | null;
    dscr: number | null;
    monthly_payment: number | null;
  };
}

export interface MissingAssumption {
  propertyId: string;
  propertyName: string;
  missing: Array<"hold_period_assumption_years" | "appreciation_assumption_pct_annual">;
}

export interface GatedResponse {
  status: "gated";
  message: string;
  missingProperties: MissingAssumption[];
}

export interface BlockedProperty {
  propertyId: string;
  propertyName: string;
  missingFields: string[];
}

export interface BlockedResponse {
  status: "blocked";
  error: "cash_flow_construction_blocked";
  reason: string;
  properties: BlockedProperty[];
}

export interface MalformedFieldError {
  status: "error";
  error: "malformed_property_data";
  propertyId: string;
  propertyName: string;
  field: string;
  message: string;
}

export interface EmptyPortfolioResponse {
  status: "empty";
  message: string;
}

export interface SuccessResponse extends PortfolioRollup {
  status: "ok";
}

export type HandlerResponse =
  | GatedResponse
  | BlockedResponse
  | MalformedFieldError
  | EmptyPortfolioResponse
  | SuccessResponse;

export interface HandlerResult {
  httpStatus: number;
  body: HandlerResponse;
}
