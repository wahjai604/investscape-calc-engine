import { rollupPortfolio } from "../../../src/E10-portfolio";
import { PropertyPosition } from "../../../src/types";
import {
  OwnedPropertyRow,
  MissingAssumption,
  HandlerResult,
  BlockedProperty,
} from "./types";

/**
 * Prompt 5g's exact gating rule (Doc 51): if hold period or appreciation
 * assumption is missing on ANY owned property, the whole portfolio figure
 * is gated — never silently excluded and recomputed on the rest.
 */
export function checkGating(rows: OwnedPropertyRow[]): MissingAssumption[] {
  const missing: MissingAssumption[] = [];

  for (const row of rows) {
    const missingFields: MissingAssumption["missing"] = [];
    if (row.hold_period_assumption_years === null || row.hold_period_assumption_years === undefined) {
      missingFields.push("hold_period_assumption_years");
    }
    if (row.appreciation_assumption_pct_annual === null || row.appreciation_assumption_pct_annual === undefined) {
      missingFields.push("appreciation_assumption_pct_annual");
    }
    if (missingFields.length > 0) {
      missing.push({
        propertyId: row.id,
        propertyName: row.address ?? row.id,
        missing: missingFields,
      });
    }
  }

  return missing;
}

const REQUIRED_NUMERIC_FIELDS: Array<{ field: keyof OwnedPropertyRow["deal"]; label: string }> = [
  { field: "purchase_price", label: "deal_inputs.purchase_price" },
  { field: "initial_cash_invested", label: "deal_metrics.initial_cash_invested" },
  { field: "cash_flow_annual", label: "deal_metrics.cash_flow_annual" },
  { field: "dscr", label: "deal_metrics.dscr" },
];

/**
 * Finds the first row with a null/non-finite value in a field rollupPortfolio()
 * needs, so the caller gets a named 4xx instead of a generic 500 or a NaN
 * silently flowing into the math.
 */
export function findMalformedField(
  rows: OwnedPropertyRow[]
): { propertyId: string; propertyName: string; field: string } | null {
  for (const row of rows) {
    for (const { field, label } of REQUIRED_NUMERIC_FIELDS) {
      const value = row.deal[field];
      if (value === null || value === undefined || typeof value !== "number" || !Number.isFinite(value)) {
        return { propertyId: row.id, propertyName: row.address ?? row.id, field: label };
      }
    }
  }
  return null;
}

/**
 * rollupPortfolio() requires every PropertyPosition to carry a real
 * cashFlowSeries. Building one needs a per-year projection (rent/expense
 * growth rate) and an exit/reversion value net of loan payoff — neither has
 * a source anywhere in the schema today: rent/expense growth rate has no
 * column at all, and exit value is Doc 54 §1's E10 ("Exit / reversion
 * engine ... Absent as an engine — returns.ts accepts exitValue as a raw
 * input"). appreciation_assumption_pct_annual alone is not a reversion
 * formula (no selling costs, no loan-payoff netting).
 *
 * Rather than invent that math here — which would mean writing new
 * calc-engine logic inside the HTTP layer, not plumbing — this always
 * blocks today. It's written as a per-property check (not a blanket
 * short-circuit) so the moment those fields/engine exist, only this
 * function needs updating.
 */
export function findBlockedProperties(rows: OwnedPropertyRow[]): BlockedProperty[] {
  return rows.map((row) => ({
    propertyId: row.id,
    propertyName: row.address ?? row.id,
    missingFields: ["rentGrowthRate", "expenseGrowthRate", "exitValue"],
  }));
}

export function rowToPropertyPosition(row: OwnedPropertyRow, cashFlowSeries: number[]): PropertyPosition {
  return {
    name: row.address ?? row.id,
    equityInvested: row.deal.initial_cash_invested as number,
    cashFlowSeries,
    annualNetCashFlow: row.deal.cash_flow_annual as number,
    dscr: row.deal.dscr as number,
    propertyValue: row.deal.purchase_price as number,
  };
}

/** Calls the real rollupPortfolio() and shapes its output for the HTTP response — no field renaming or recomputation. */
export function buildSuccessBody(properties: PropertyPosition[]) {
  return { status: "ok" as const, ...rollupPortfolio(properties) };
}

export function handlePortfolioRollup(rows: OwnedPropertyRow[]): HandlerResult {
  if (rows.length === 0) {
    return {
      httpStatus: 200,
      body: { status: "empty", message: "No owned properties found for this account." },
    };
  }

  const missingProperties = checkGating(rows);
  if (missingProperties.length > 0) {
    return {
      httpStatus: 200,
      body: {
        status: "gated",
        message: `${rows.length - missingProperties.length} of ${rows.length} properties ready — add hold period and appreciation assumptions for the rest to see blended IRR.`,
        missingProperties,
      },
    };
  }

  const malformed = findMalformedField(rows);
  if (malformed) {
    return {
      httpStatus: 422,
      body: {
        status: "error",
        error: "malformed_property_data",
        propertyId: malformed.propertyId,
        propertyName: malformed.propertyName,
        field: malformed.field,
        message: `${malformed.field} is missing or not a finite number for "${malformed.propertyName}".`,
      },
    };
  }

  const blocked = findBlockedProperties(rows);
  if (blocked.length > 0) {
    return {
      httpStatus: 501,
      body: {
        status: "blocked",
        error: "cash_flow_construction_blocked",
        reason:
          "Exit/reversion engine (Doc 54 E10) and rent/expense growth rate assumptions do not exist in the calc engine or schema. Cannot construct cashFlowSeries without inventing new financial logic.",
        properties: blocked,
      },
    };
  }

  // Unreachable until the block above has a real construction path — kept
  // so the success path is wired and typechecked, not stubbed out.
  const properties = rows.map((row) => rowToPropertyPosition(row, []));
  return { httpStatus: 200, body: buildSuccessBody(properties) };
}

/** Pure auth decision so it's testable without a Deno runtime. verifyJwt is injected — the real caller passes supabase.auth.getUser(). */
export async function authorizeRequest(
  authHeader: string | null,
  verifyJwt: (jwt: string) => Promise<{ id: string } | null>
): Promise<{ ok: true; userId: string } | { ok: false; httpStatus: 401; body: { status: "error"; error: "unauthenticated" } }> {
  const unauthenticated = {
    ok: false as const,
    httpStatus: 401 as const,
    body: { status: "error" as const, error: "unauthenticated" as const },
  };

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthenticated;
  }

  const jwt = authHeader.slice("Bearer ".length).trim();
  if (!jwt) {
    return unauthenticated;
  }

  const user = await verifyJwt(jwt);
  if (!user) {
    return unauthenticated;
  }

  return { ok: true, userId: user.id };
}
