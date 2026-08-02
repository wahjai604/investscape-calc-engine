// Deno entrypoint. Business logic lives in handler.ts/query.ts (plain TS,
// no Deno-only globals) so it can be unit-tested under the repo's existing
// Jest setup — see tests/portfolio-rollup.test.ts. This file only wires
// HTTP <-> Supabase auth <-> that logic.
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeRequest, handlePortfolioRollup } from "./handler.ts";
import { fetchOwnedProperties } from "./query.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");

  // Client scoped to the caller's own JWT, not the service role — RLS
  // (Doc 02 §3 "own_properties"/"own_deals") enforces isolation even if
  // the filter below were ever removed or bypassed.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  const auth = await authorizeRequest(authHeader, async (jwt: string) => {
    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data.user) return null;
    return { id: data.user.id };
  });

  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rows = await fetchOwnedProperties(supabase, auth.userId);
    const result = handlePortfolioRollup(rows);
    return new Response(JSON.stringify(result.body), {
      status: result.httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", error: "query_failed", message: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
