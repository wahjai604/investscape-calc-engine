import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { OwnedPropertyRow } from "./types";

/**
 * Owned properties for the calling user, joined one hop to their 'Owned'
 * deal's inputs/metrics (Doc 02 §properties/deals/deal_inputs/deal_metrics).
 * `userId` must come from the authenticated session (see index.ts) — never
 * from a request parameter, so RLS ("own_properties"/"own_deals" policies,
 * Doc 02 §3) and this explicit filter both scope to the caller's own rows.
 *
 * Assumes at most one 'Owned' deal per property. If a property somehow has
 * more than one, the join returns one row per matching deal; the .order()
 * below makes the most-recently-created Owned deal win, deterministically
 * — the schema doesn't define which deal should win in that case, so this
 * is a documented tie-break, not a discovered rule.
 */
export async function fetchOwnedProperties(
  supabase: SupabaseClient,
  userId: string
): Promise<OwnedPropertyRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      `
      id,
      address,
      acquisition_date,
      hold_period_assumption_years,
      appreciation_assumption_pct_annual,
      deals!inner (
        id,
        status,
        deal_inputs ( purchase_price ),
        deal_metrics ( initial_cash_invested, cash_flow_annual, dscr, monthly_payment )
      )
    `
    )
    .eq("user_id", userId)
    .eq("deals.status", "Owned")
    .order("created_at", { ascending: false, foreignTable: "deals" });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => {
    const deal = row.deals[0];
    return {
      id: row.id,
      address: row.address,
      acquisition_date: row.acquisition_date,
      hold_period_assumption_years: row.hold_period_assumption_years,
      appreciation_assumption_pct_annual: row.appreciation_assumption_pct_annual,
      deal: {
        id: deal.id,
        purchase_price: deal.deal_inputs?.purchase_price ?? null,
        initial_cash_invested: deal.deal_metrics?.initial_cash_invested ?? null,
        cash_flow_annual: deal.deal_metrics?.cash_flow_annual ?? null,
        dscr: deal.deal_metrics?.dscr ?? null,
        monthly_payment: deal.deal_metrics?.monthly_payment ?? null,
      },
    };
  });
}
