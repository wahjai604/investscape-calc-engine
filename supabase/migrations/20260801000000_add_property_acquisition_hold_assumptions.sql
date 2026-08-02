-- Doc 51 "Schema/backend note" item 2 (per Doc 50 §2, unblocked by Prompt 5g):
-- these three columns were specced but never applied to the live schema.
-- The portfolio-rollup Edge Function's gating query depends on the latter
-- two existing. NOT YET APPLIED to any environment — review before running.
ALTER TABLE properties
  ADD COLUMN acquisition_date date,
  ADD COLUMN hold_period_assumption_years numeric,
  ADD COLUMN appreciation_assumption_pct_annual numeric;
