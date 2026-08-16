# US Qualifier Engine (E73–E77) — Sourced Numbers

**As of August 2026.** FHA MIP tiers in particular change periodically (HUD Mortgagee Letters), and PMI/DTI conventions vary by lender/investor — re-verify before treating any figure here as current, and definitely before relying on it for a real underwriting decision. This engine follows the same discipline as the US Tax Strategies engine (E68–E70, see `investscape-tax-engine/docs/US-TAX-STRATEGIES-SOURCES.md`): every constant in `src/utils/constants.ts`'s "E73-E77" section is documented here, one entry per constant, so a future editor changing a number knows what they're changing and why.

No Canadian-style stress test exists for the US — the 2021 CFPB rule replaced the old 43% DTI/Appendix Q basis with a lender-side APR-vs-APOR safe harbour, which isn't a borrower-facing affordability number at all. Do not add a "US stress test" concept to this engine; what's modeled instead is the real back-end DTI ratio ceiling, which is genuinely borrower-facing.

---

## E73: DTI stress tiers + conforming loan limit

| Constant | Value | Source & rationale |
|---|---|---|
| `US_DTI_MANUAL_MAX` | 36% | Fannie Mae Selling Guide B3-6-02 — manual-underwriting baseline maximum back-end DTI. |
| `US_DTI_COMPENSATING_MAX` | 45% | Same guide — extendable ceiling when the borrower meets a real compensating factor (credit score, reserves, or LTV — see below), not automatically. |
| `US_DTI_AUTOMATED_MAX` | 50% | Automated-underwriting (DU/LPA-equivalent) "Approve/Eligible" ceiling — an automated system already accounts for compensating factors internally, so this applies regardless of the individual factor checks below. |
| `US_DTI_COMPENSATING_MIN_CREDIT_SCORE` | 680 | Modeling choice: one of three real compensating factors that unlocks the 45% manual tier. Not itself a single universally-cited number — Fannie Mae's actual Eligibility Matrix cross-tabs credit score against LTV and loan type in a full grid; this is a defensible single threshold for a v1 engine, documented as such rather than presented as the literal matrix. |
| `US_DTI_COMPENSATING_MIN_RESERVE_MONTHS` | 6 | Same modeling basis — 6 months PITI reserves is a commonly-cited compensating-factor threshold in the sourced research. |
| `US_DTI_COMPENSATING_MAX_LTV` | 75% | Same modeling basis — a lower LTV (more borrower equity) is a recognized compensating factor. |
| `US_CONFORMING_LOAN_LIMIT_STANDARD` | $832,750 | [FHFA Announces Conforming Loan Limit Values for 2026](https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026) — standard 1-unit property, most of the country. **D2, admin-maintained** — FHFA resets this annually. |
| `US_CONFORMING_LOAN_LIMIT_HIGH_COST` | $1,249,125 | [FHFA Conforming Loan Limit Values](https://www.fhfa.gov/data/conforming-loan-limit) — high-cost areas (Alaska/Hawaii/Guam/USVI and FHFA-designated high-cost counties, capped at 150% of the standard limit). |

**Compensating-factor logic is `US_DTI_COMPENSATING_MAX` is unlocked by ANY ONE of the three factors above (OR, not AND)** — `calculateUSDTITier()` in `E73-us-qualifying.ts` checks credit score, reserve months, and LTV independently and unlocks the 45% tier if any one clears its threshold. This is a simplification of Fannie Mae's real Eligibility Matrix (which is a fuller grid), documented as a v1 modeling choice, not a transcription of the actual matrix.

**Jumbo financing is flagged, not calculated.** `qualifyForUSMortgage()` reports `conformingLoanLimitCheck.exceedsConformingLimit` when the loan amount exceeds the applicable limit — jumbo underwriting itself (different DTI/reserve conventions) is explicit Phase 2 scope, not built here.

---

## E74: FHA MIP

| Constant | Value | Source & rationale |
|---|---|---|
| `FHA_UFMIP_RATE` | 1.75% | [FHA Mortgage Insurance (MIP): 2026 Requirements — Neighbors Bank](https://www.neighborsbank.com/fha-loans/fha-mortgage-insurance/); [FHA MIP Chart 2026](https://mortgage-info.com/blog/fha-mip-chart-2026-mortgage-insurance-premiums) — upfront MIP, financed into the loan or paid at closing. |
| `FHA_ANNUAL_MIP_TIERS.thirtyYear.highLTVRate` | 0.55% | Same sources — 30-year term, under 5% down (LTV > 95%), the typical/most common tier. |
| `FHA_ANNUAL_MIP_TIERS.thirtyYear.lowLTVRate` | 0.50% | Same sources — 30-year term, at/above 5% down. |
| `FHA_ANNUAL_MIP_TIERS.fifteenYear.highLTVRate` | 0.40% | Same sources — 15-year term, under 10% down. |
| `FHA_ANNUAL_MIP_TIERS.fifteenYear.lowLTVRate` | 0.15% | Same sources — 15-year term, at/above 10% down (substantial down payment); the sourced floor of the annual MIP range. |
| `FHA_ANNUAL_MIP_TIERS.aboveConformingLimitSurcharge` | 0.20% | **Composed, not independently sourced**: the research gave "up to 0.75% for higher-LTV/larger-loan tiers" as the ceiling. 0.55% (the 30yr high-LTV base) + 0.20% surcharge = 0.75% exactly, so the surcharge value is *derived* from the documented ceiling rather than cited on its own from a rate table. Verify against a current HUD Mortgagee Letter before relying on the exact surcharge split (base vs. surcharge) rather than just the combined ceiling. |
| `FHA_MIP_ELEVEN_YEAR_REMOVAL_MIN_DOWN_PAYMENT` | 10% | Post-2013 FHA rule: annual MIP removes automatically after 11 years only if the down payment was at least 10%; otherwise it runs for the life of the loan. |
| `FHA_MIP_AUTOMATIC_REMOVAL_YEARS` | 11 | Same rule. |

**Four real branches, not one flat rate**: `calculateFHAAnnualMIPRate()` branches on loan term (15 vs. 30yr, via `amortizationYears <= 15`), down-payment tier (high/low LTV within that term), and whether the loan exceeds the applicable conforming limit (adds the surcharge). `isHighCostArea` selects which conforming limit the surcharge check uses.

---

## E75: Conventional PMI

| Constant | Value | Source & rationale |
|---|---|---|
| `PMI_REQUIRED_LTV_THRESHOLD` | 80% | Homeowners Protection Act convention — PMI required above 80% LTV; the LTV level at which it becomes borrower-cancellable-on-request. |
| `PMI_RATE_FLOOR` / `PMI_RATE_CEILING` | 0.3% / 1.5% | [Private Mortgage Insurance (PMI) Cost — Experian](https://www.experian.com/blogs/ask-experian/how-much-does-private-mortgage-insurance-pmi-cost/) — the sourced real-world annual range, used as hard clamp bounds on the computed rate. |
| `PMI_LTV_TIERS` | 0.5%–1.2% base, by LTV band | **Composed, not independently sourced per band**: the research gave only the overall 0.3%–1.5% range, driven by "credit score, LTV, and term." This engine models four LTV bands (≤85%, ≤90%, ≤95%, ≤97%) with an ascending base rate, which is a defensible internal structure that reproduces the documented range at its extremes (see `PMI_CREDIT_SCORE_MULTIPLIERS` below) — not a literal rate card from any single lender. |
| `PMI_CREDIT_SCORE_MULTIPLIERS` | 0.6×–1.5×, by credit band | Same basis — a credit-score multiplier applied to the LTV-tier base rate. At the best combination (LTV ≤85%, score ≥760) this reproduces exactly the 0.3% floor; at the worst (LTV ≤97%, score <680) it reproduces exactly the 1.5% ceiling, both by construction. |

**A real zero, not an omitted field, below 80% LTV** — `calculateConventionalPMI()` always returns `annualPMIRate`/`annualPMIAmount`/`monthlyPMIAmount`, all `0` when `pmiRequired` is `false`, rather than leaving them undefined.

---

## E76: Loan-convention DSCR (gross rent ÷ PITIA)

**This is NOT the same metric as `E9-dscr.ts`'s `calculateDSCR`/`evaluateDSCR`** (net operating income ÷ annual debt service, the commercial-lending convention). Every export in `E76-dscr-loan-sizing.ts` keeps the `LoanConvention` qualifier in its name specifically to prevent this exact mix-up — see that file's own header comment.

| Constant | Value | Source & rationale |
|---|---|---|
| `DSCR_LOAN_MIN_RATIO_DEFAULT` | 1.0 | [DSCR Loans 2026 — Griffin Funding](https://griffinfunding.com/non-qm-mortgages/dscr-loans/); [DSCR Loan Requirements for Investment Property in 2026 — Home Abroad](https://homeabroadinc.com/mortgages/dscr-loan-requirements/) — the real, sourced typical minimum ratio floor across lenders, used as the v1 default. Admin-overridable per deal/lender via `minimumRatioOverride`. |
| `DSCR_LOAN_STRONG_RATIO_THRESHOLD` | 1.25 | Same sources — the ratio at/above which a DSCR loan typically unlocks a lender's best pricing tier. Informational only (`qualifiesForBestTerms`), not a second pass/fail gate. |
| `DSCR_LOAN_MIN_FICO_DEFAULT` | 620 | Same sources — low end of the sourced 620–660 typical minimum FICO range. Not currently consumed by any calculation in this v1 (no FICO gate is implemented in E76 itself), retained as a documented reference default for whatever UI/admin surface surfaces DSCR-loan program minimums. |
| `DSCR_LOAN_MIN_DOWN_PAYMENT_DEFAULT` | 20% | Same sources — low end of the sourced 20–25% typical minimum down payment range. Same reference-only status as the FICO default above. |

**Sub-1.0 / "no-ratio" programs are a named exception, not the default.** `evaluateLoanConventionDSCR()`'s `lenderAllowsNoRatioProgram` input flag changes the wording of the returned issue when the ratio is below minimum, but does **not** change `belowStandardMinimum`/`meetsMinimumRatio` — this engine does not model the no-ratio program's own underwriting math (reserves-substitute-for-ratio), only flags that such programs exist as a real lender-specific alternative.

---

## E77: US qualifying rental income (75% rule)

| Constant | Value | Source & rationale |
|---|---|---|
| `RENTAL_INCOME_HAIRCUT` | 75% | [Fannie Mae B3-3.8-01, Rental Income (10/08/2025)](https://selling-guide.fanniemae.com/sel/b3-3.8-01/rental-income); [Fannie Mae Guidelines: Qualifying Rental Income — Homebuyer.com](https://homebuyer.com/guidelines/fannie-mae/rental-income-b3-3-1-08) — 75% of gross monthly rent counts toward qualifying income when a signed lease exists. The 25% haircut is the lender's standard vacancy/maintenance allowance, not a number this build invented. Formerly cited as §B3-3.1-08; consolidated under §B3-3.8-01 as of the October 2025 Selling Guide. |

**Lease-based path only — v1 scope.** The real Fannie Mae rule has two calculation paths: (a) lease-based 75%-of-gross for new purchases/recent conversions (implemented here), or (b) Schedule E net-income-plus-depreciation-addback for properties owned ≥2 years with tax-return history (**not implemented — Phase 2**, since it needs tax-return-history data this build doesn't collect, not just different math). `calculateQualifyingRentalIncomeUS()` refuses to apply the 75% haircut without `hasSignedLease: true` and returns `qualifyingRentalIncome: null` with an explicit issue rather than falling back to an unverified market-rent estimate.

---

## Explicit Phase 2 non-goals (do not build under this engine)

- Schedule E / 2-year tax-return-history rental income method (E77's path (b) above)
- Jumbo loan qualification math beyond the conforming-limit flag (E73 only flags; doesn't compute jumbo terms)
- Full state-by-state US transfer/excise tax (a separate concern, not part of qualifying at all)
- VA loan qualification (conventional + FHA/DSCR only in v1, per the original research's product-decision Q2)

---

## Verification checklist for a future editor

- [ ] Re-check `FHA_ANNUAL_MIP_TIERS` against the current HUD Mortgagee Letter — this is the single most likely table to have changed since August 2026, and the `aboveConformingLimitSurcharge` split specifically was derived/composed rather than independently cited (see E74 section above).
- [ ] Re-check `US_CONFORMING_LOAN_LIMIT_STANDARD`/`_HIGH_COST` against the current-year FHFA announcement — these reset annually by design.
- [ ] `US_DTI_COMPENSATING_MIN_CREDIT_SCORE`/`_MIN_RESERVE_MONTHS`/`_MAX_LTV` and the `PMI_LTV_TIERS`/`PMI_CREDIT_SCORE_MULTIPLIERS` tables are documented modeling choices composed to reproduce the sourced overall ranges, not literal single-lender rate cards — if a real underwriting matrix becomes available, prefer replacing these with the real table rather than tuning the composed one further.
- [ ] `DSCR_LOAN_MIN_FICO_DEFAULT`/`_MIN_DOWN_PAYMENT_DEFAULT` are reference-only in this v1 (not consumed by any E76 calculation) — if a future pass adds FICO/down-payment gating to the DSCR-loan flow, wire these in rather than adding new unnamed constants.
