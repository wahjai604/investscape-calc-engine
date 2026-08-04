# InvestScape Calculation Engine — Build Status Audit

**Audit run:** 2026-08-04 11:16 PST
**Repository:** `investscape-calc-engine` (branch: `master`, HEAD: `9ec9e9b` "Phase 1 Complete: E1-E24 engines + 300 tests passing")
**Auditor:** Claude Code, automated static + dynamic analysis (test execution, source inspection, git history)

> **Methodology note on E# mapping:** This repo does not contain the E1–E28 spec document itself (no "Doc 78" file exists anywhere in the working tree, git history, or `investscape-docs/`, which is currently empty). E#-to-file mapping below is reconstructed from (a) explicit `E##` references in code/test comments — treated as **confirmed** — and (b) the ordered lists in the `9ec9e9b` commit message, cross-checked for internal consistency — treated as **inferred**. Where a mapping could not be reconciled with confidence, it is marked **unverified** rather than guessed. If you have the actual spec doc, it should supersede this section.

---

## Task 1: Test Execution & Results

**Command:** `npm install && npm test`

```
> investscape-calc-engine@1.0.0 test
> jest

Test Suites: 22 passed, 22 total
Tests:       300 passed, 300 total
Snapshots:   0 total
Time:        ~15-17s
Ran all test suites.
```

- **Total test suites:** 22 (22 passed / 0 failed)
- **Total tests:** 300 (300 passed / 0 failed / 0 pending/skipped)
- **Errors:** none
- **TypeScript typecheck (`npx tsc --noEmit`):** clean, no errors

Full raw output plus a per-suite pass/fail breakdown saved to `TEST-RESULTS-AUG-4-2026.txt`.

Per-suite test counts:

| Test file | Tests |
|---|---:|
| tests/data-provenance.test.ts | 29 |
| tests/tax-optimization.test.ts | 30 |
| tests/rental-waterfall.test.ts | 24 |
| tests/fx-conversion.test.ts | 21 |
| tests/ptt.test.ts | 21 |
| tests/scenario.test.ts | 20 |
| tests/break-even.test.ts | 19 |
| tests/holding-period-sensitivity.test.ts | 18 |
| tests/amortization.test.ts | 13 |
| tests/brrrr.test.ts | 13 |
| tests/refinance.test.ts | 13 |
| tests/cashflow.test.ts | 12 |
| tests/exit.test.ts | 12 |
| tests/portfolio-rollup.test.ts | 10 |
| tests/appreciation.test.ts | 10 |
| tests/capitalstack.test.ts | 7 |
| tests/qualifying.test.ts | 5 |
| tests/cmhc.test.ts | 5 |
| tests/dscr.test.ts | 4 |
| tests/returns.test.ts | 4 |
| tests/mortgage.test.ts | 2 |
| tests/portfolio.test.ts | 8 |
| **Total** | **300** |

**Build artifact note (not part of `npm test`, found during audit):** `dist/` (gitignored, untracked, present locally from a prior `npm run build`) only contains compiled output for 10 of the 27 current source files — `mortgage`, `cmhc`, `qualifying`, `dscr`, `cashflow`, `returns`, `capitalstack`, `portfolio`, `exit`, `amortization`, plus `index`. The 17 files added in the `9ec9e9b` Phase 1 commit (ptt, break-even, brrrr, refinance, scenario, appreciation, holding-period-sensitivity, tax-optimization, data-provenance, fx-conversion, rental-waterfall, amortization-display, chart-data, property-tax, opex-benchmark, insurance-estimation, lender-scorecard) have never been compiled. Anyone consuming this package via `main`/`types` (`dist/index.js`) is on a stale build — `npm run build` needs to be re-run before publishing/consuming.

---

## Task 2: Engine Implementation Inventory

For each source file: purpose, exports, best-available E# mapping, validation status, and known issues. No `TODO`/`FIXME`/`BUG`/`CRITICAL`/`BLOCKER` markers were found anywhere in `src/` or `tests/` (full-repo grep, zero matches) — the codebase is clean of that class of self-flagged issue. "Known issues" below are therefore drawn from design notes in doc-comments and structural gaps found during this audit, not author-flagged TODOs.

### mortgage.ts — Canadian/US mortgage payment calculators
- **Exports:** `MortgageInput`, `semiAnnualToMonthlyRate`, `calculateMonthlyMortgagePayment`, `monthlyCompoundingRate`, `calculateMonthlyUSMortgagePayment`
- **E#:** E1 (inferred — "Core engines E1-E5" bucket, 1st item)
- **Validation:** FCAC-validated (explicit "all FCAC-validated" in commit `4103105`; also the base referenced by `amortization.ts`'s "existing, FCAC-validated payment functions")
- **Issues:** none found

### amortization.ts — full & per-tranche amortization schedules
- **Exports:** `MortgageCountry`, `AmortizationRow`, `amortizationSchedule`, `remainingBalance`, `AmortizingTranche`, `TrancheAmortizationRow`, `trancheAmortizationSchedule`
- **E#:** E2 (base schedule, inferred) + **E8 confirmed** (tranche schedule — commit `f90e187` title: "per-tranche amortization schedule engine (E8)")
- **Validation:** FCAC-validated payment math; tests independently hand-verified against a computed month-60 balance ($622,781) and a published $599.55/month reference payment
- **Issues:** none found

### cashflow.ts — multi-period cash flow projection
- **Exports:** `FlatDebtServiceInput`, `RealDebtServiceInput`, `CashFlowProjectionInput`, `YearlyCashFlow`, `projectCashFlows`
- **E#:** E3 (base, inferred) + **E9 confirmed** (real debt-service path sourced from `amortizationSchedule()`, per inline comment)
- **Validation:** golden-figure tests, hand-verified year 1/3/5 outputs; independently hand-verified per commit `f2564c8`
- **Issues:** none found

### exit.ts — sale price & full-cycle exit proceeds/IRR
- **Exports:** `SalePriceInput`, `calculateSalePrice`, `ExitProceedsInput`, `ExitProceedsResult`, `calculateExitProceeds`
- **E#:** E4 (`calculateSalePrice`, inferred) + **E10** (`calculateExitProceeds` — inferred from exit.test.ts's "property across E8/E9/E10" comment, which frames this function as the composition layer over E8 (amortization) and E9 (cashflow))
- **Validation:** independently testable design; hand-verified test cases
- **Issues:** none found

### returns.ts — IRR / MIRR / equity multiple
- **Exports:** `buildInvestmentCashFlowSeries`, `calculateIRR`, `calculateMIRR`, `calculateEquityMultiple`
- **E#:** E5 (inferred)
- **Validation:** golden tests, independently hand-verified per commit `d0c82bb`
- **Issues:** only 4 test cases for 4 exported functions — thinnest coverage-to-surface-area ratio of any validated engine (see Task 6)

### qualifying.ts — OSFI GDS/TDS mortgage stress test
- **Exports:** `StressTestQualifyingInput`, `StressTestQualifyingResult`, `calculateStressTestRate`, `qualifyForMortgage`
- **E#:** one of {E6, E7, E11, E13, E15} — bucket-confirmed, exact slot **unverified** (see methodology note)
- **Validation:** OSFI/FCAC-validated (explicit inline comment); hand-verified per commit `655fb1c`
- **Issues:** none found

### dscr.ts — NOI and DSCR calculators
- **Exports:** `NOIInput`, `calculateNOI`, `DSCRInput`, `calculateDSCR`, `DSCREvaluationInput`, `DSCREvaluationResult`, `evaluateDSCR`
- **E#:** one of {E6, E7, E11, E13, E15} — **unverified**
- **Validation:** self-validated (arithmetic-identity tests only, e.g. `NOI = rent − vacancy − opex`); no external reference cited
- **Issues:** thin coverage — 4 tests for 3 exported functions; `evaluateDSCR` (the composed evaluation function) has no dedicated test distinct from the two primitives it wraps

### capitalstack.ts — multi-tranche capital stack
- **Exports:** `TrancheType`, `Tranche`, `TrancheResult`, `CapitalStackResult`, `calculateCapitalStack`
- **E#:** one of {E6, E7, E11, E13, E15} — **unverified**
- **Validation:** hand-verified per commit `1a33d40`-adjacent work; note commit `8118383` renamed `blendedCostOfCapital` → `weightedAverageCost` specifically to avoid an incorrect "WACC" claim — a real methodological correction, not just naming
- **Issues:** none currently open (the WACC-naming issue was fixed, not left open)

### portfolio.ts — portfolio rollup (pooled cash flows, concentration risk)
- **Exports:** `PropertyPosition`, `PropertyIRRDetail`, `ConcentrationRisk`, `PortfolioRollup`, `poolPortfolioCashFlows`, `rollupPortfolio`
- **E#:** one of {E6, E7, E11, E13, E15} — **unverified**
- **Validation:** independently hand-verified per commit `1a33d40`
- **Issues:** **historical bug, fixed** — commit `544ad82` fixed portfolio IRR being incorrectly *averaged* across properties instead of correctly *pooled* from combined cash flows (tagged "DERIVED-THIN fix per Doc 54 Step 1"). Confirms a real external audit doc ("Doc 54") existed and drove concrete fixes; that doc is not present in this repo either.

### break-even.ts — break-even down payment / monthly payment
- **Exports:** `BreakEvenInput`, `BreakEvenResultDownPayment`, `BreakEvenResultMonthlyPayment`, `BreakEvenMode`, `BreakEvenResult`, `calculateAnnualCashFlow`, `breakEvenDownPayment`, `breakEvenMonthlyPayment`, `calculateBreakEven`
- **E#:** one of {E6, E7, E11, E13, E15} — **unverified**
- **Validation:** FCAC-referenced (per grep hit); 19 tests
- **Issues:** not exported from `src/index.ts` (see cross-cutting note in Task 6)

### ptt.ts — BC/US Property Transfer Tax
- **Exports:** `PTTInput`, `PTTResult`, `calculateBCPTT`, `calculateUSPTT`, `calculatePTT`
- **E#:** **E12 confirmed** (inline test comments: "per E12's spec wording", "per E12 §5")
- **Validation:** spec-validated against BC's statutory PTT bracket schedule (1%/2%/3%/2%-surcharge bands) plus a "Template v2" reference case
- **Issues:** none found; not exported from `src/index.ts`

### amortization-display.ts — display-layer monthly/annual schedule views
- **Exports:** `DisplayTrancheType`, `DisplayTranche`, `AmortizationDisplayInput`, `DisplayMonthlyRow`, `DisplayAnnualRow`, `TrancheSchedule`, `CombinedView`, `AmortizationDisplayResult`, `generateAmortizationDisplay`, `getTrancheSummary`
- **E#:** **E14 confirmed** (`chart-data.ts` inline comment: "Each tranche's E14 monthly_rows...")
- **Validation:** built on top of already-validated `amortization.ts`/E8 data; no dedicated test file in `tests/` for this file's own logic beyond what's exercised indirectly
- **Issues:** no `amortization-display.test.ts` exists — untested in isolation (see Task 6)

### chart-data.ts — chart-ready data transforms for UI
- **Exports:** `DealSummary`, `ChartDataInput`, `BarChartData`, `LineChartData`, `MultiLineChartData`, `ChartData`, `generateAnnualCFBars`, `generateMonthlyCumulativeLine`, `generateMultiTrancheLine`, `generateChartData`
- **E#:** one of {E6, E7, E11, E13, E15} — **unverified**
- **Validation:** none — no test file exists for this module at all
- **Issues:** **zero test coverage** (see Task 6)

### appreciation.ts — property appreciation projection
- **Exports:** `AppreciationInput`, `AppreciationResult`, `calculateAppreciation`
- **E#:** E16 (inferred — "Scenarios & sensitivity E16-E20" bucket, 1st item, consistent with E18/E19 confirmed positions 3/4)
- **Validation:** hand-verified, 10 tests
- **Issues:** none found

### refinance.ts — refinance analysis
- **Exports:** `RefinanceInput`, `RefinanceResult`, `calculateRefinance`
- **E#:** E17 (inferred, same bucket logic as above)
- **Validation:** FCAC-referenced; 13 tests
- **Issues:** none found

### scenario.ts — scenario comparison engine
- **Exports:** `DealParameters`, `ScenarioAssumptions`, `ScenarioInput`, `ScenarioOutcome`, `ScenarioComparisonResult`, `calculateScenarioComparison`
- **E#:** **E18 confirmed** (inline: "the E18 spec")
- **Validation:** hand-verified, 20 tests
- **Issues:** none found

### brrrr.ts — Buy/Rehab/Rent/Refinance/Repeat modeling
- **Exports:** `BRRRRInput`, `BRRRRResult`, `calculateBRRRR`
- **E#:** **E19 confirmed** (inline: "the E19 spec's input")
- **Validation:** hand-verified, 13 tests
- **Issues:** doc-comment flags a field ("rate on original acquisition loan") as "not in the E19 spec's input" — the engine extends beyond spec scope by design choice, not an error, but worth spec-reconciliation

### holding-period-sensitivity.ts — hold-period sensitivity analysis
- **Exports:** `HoldingPeriodSensitivityInput`, `HoldPeriodOutcome`, `HoldingPeriodSensitivityResult`, `calculateHoldingPeriodSensitivity`
- **E#:** E20 (inferred)
- **Validation:** 18 tests; one test explicitly notes gross equity is "derived from a flat-growth appreciation" assumption (documented scope, not a bug)
- **Issues:** none found

### tax-optimization.ts — tax optimization calculations
- **Exports:** `TaxOptimizationInput`, `TaxOptimizationResult`, `calculateTaxOptimization`
- **E#:** E21 (inferred — "Tax & provenance E21-E24" bucket, 1st item, consistent with E22/E23 confirmed positions 2/3)
- **Validation:** self-validated (30 tests, largest suite by count; includes an "internally consistent" cross-check between the summary string and typed fields, but no external tax-authority reference cited)
- **Issues:** none found

### data-provenance.ts — field-level data confidence/provenance tracking
- **Exports:** `ProvenanceSource`, `ProvenanceEntry`, `DataProvenanceInput`, `ConfidenceLabel`, `TrackedField`, `DataProvenanceResult`, `calculateDataProvenance`
- **E#:** **E22 confirmed** (inline: "the E22 spec" x3)
- **Validation:** 29 tests; doc-comments flag that confidence-band thresholds and the "lastUpdatedDate" reference point are **not fully specified by the E22 spec** and were filled in by implementation judgment
- **Issues:** spec-underdetermined areas explicitly documented — not a code bug, but a spec-completeness gap worth flagging upstream

### fx-conversion.ts — currency conversion & FX sensitivity
- **Exports:** `CurrencyCode`, `FXRateSource`, `DealMetrics`, `FXConversionInput`, `CurrencyMetrics`, `FXSensitivity`, `FXConversionResult`, `calculateFXConversion`
- **E#:** **E23 confirmed** (inline: "the E23 spec" x2, "E23's spec's own rule")
- **Validation:** hand-verified, 21 tests
- **Issues:** doc-comment notes one field was "not in the original E23 field list" and was added because `fxSensitivity` needed it — a deliberate spec extension, documented

### rental-waterfall.ts — unit-level rental cash flow waterfall
- **Exports:** `RentalUnit`, `RentalWaterfallInput`, `UnitMetrics`, `MonthlyCashFlow`, `AnnualSummary`, `RentalWaterfallResult`, `calculateRentalWaterfall`
- **E#:** E24 (inferred)
- **Validation:** self-validated (24 tests, arithmetic-identity style, e.g. gross/vacancy/effective rent reconciliation); no external reference cited
- **Issues:** not exported from `src/index.ts`

### property-tax.ts — property tax estimator
- **Exports:** `PropertyTaxCountry`, `PropertyType`, `TaxRateSource`, `PropertyTaxInput`, `PropertyTaxResult`, `calculatePropertyTax`
- **E#:** **E25 confirmed** (inline: "the E25 spec")
- **Validation:** **none — no test file exists** (`tests/property-tax.test.ts` is absent)
- **Issues:** commit `9ec9e9b` message explicitly flags E25-E28 as "[tests pending]" — this is a self-acknowledged gap, not an oversight, but it means this engine has shipped with zero automated verification

### opex-benchmark.ts — operating expense benchmark estimator
- **Exports:** `OpExPropertyType`, `LocationTier`, `OpExBenchmarkInput`, `OpExBreakdown`, `OpExBenchmarkResult`, `calculateOpExBenchmark`
- **E#:** **E26 confirmed** (inline: "the E26 spec" x4)
- **Validation:** **none — no test file exists**
- **Issues:** same "[tests pending]" gap as above. Doc-comments note per-category benchmark percentages are "not given anywhere in the E26 spec" — an unresolved spec gap on top of the missing tests.

### insurance-estimation.ts — property insurance premium estimator
- **Exports:** `InsurancePropertyType`, `InsuranceCountry`, `InsuranceEstimationInput`, `InsuranceBreakdown`, `InsuranceEstimationResult`, `calculateInsuranceEstimation`
- **E#:** **E27 confirmed** (inline: "the E27 spec" x3)
- **Validation:** **none — no test file exists**
- **Issues:** same "[tests pending]" gap. Two input fields are explicitly documented as accepted but unused ("Not used in any calculation") — dead/decorative fields in the public interface.

### lender-scorecard.ts — lender qualification scorecard
- **Exports:** `LenderCountry`, `LoanType`, `LenderPropertyType`, `LenderScorecardInput`, `QualificationLikelihood`, `CreditScoreContext`, `ScoreBreakdown`, `LenderScorecardResult`, `calculateLenderScorecard`
- **E#:** **E28 confirmed** (inline: "the E28 spec" x4)
- **Validation:** **none — no test file exists**
- **Issues:** same "[tests pending]" gap. Doc-comment flags an unresolved "ambiguity in the E28 spec" around its own worked Borderline-case examples.

### index.ts — public package entry point
- **Exports (re-exports only):** `calculateMonthlyMortgagePayment`, `calculateCMHCPremium`, `qualifyForMortgage`, `calculateNOI`, `calculateDSCR`, `projectCashFlows`, `calculateIRR`, `calculateMIRR`, `calculateEquityMultiple`, `calculateCapitalStack`, `rollupPortfolio`, `calculateExitProceeds`, `trancheAmortizationSchedule`
- **Issues:** exports only 13 of the ~65+ functions defined across 27 source files. Everything from `break-even.ts` onward (18 of 27 files: break-even, ptt, amortization-display, chart-data, appreciation, refinance, scenario, brrrr, holding-period-sensitivity, tax-optimization, data-provenance, fx-conversion, rental-waterfall, property-tax, opex-benchmark, insurance-estimation, lender-scorecard) has **no public export path**. Internally tested and working, but unreachable by anything importing this package by name. See Task 6.

### cmhc.ts — CMHC mortgage default insurance premium
- **Exports:** `CMHCPremiumInput`, `calculateCMHCPremium`
- **E#:** part of E1 cluster (inferred; bundled with mortgage.ts in commit `4103105`)
- **Validation:** validated against CMHC's published premium schedule (LTV bands + amortization surcharge)
- **Issues:** none found

---

## Task 3: Test File Analysis

| Test file | Test cases | Categories tested | External/reference basis | Skipped/failing |
|---|---:|---|---|---|
| tests/mortgage.test.ts | 2 | Canadian semi-annual & US monthly payment calc | FCAC-published payment formulas | none |
| tests/cmhc.test.ts | 5 | CMHC premium by LTV band, amortization surcharge | CMHC published premium schedule | none |
| tests/qualifying.test.ts | 5 | GDS/TDS stress test, qualify/fail paths, stress rate floor | OSFI/FCAC stress-test rules | none |
| tests/dscr.test.ts | 4 | NOI subtraction, DSCR division, evaluation composition | Self-validated arithmetic | none |
| tests/cashflow.test.ts | 12 | Multi-year projection, growth compounding, monotonicity | Hand-verified golden figures (yrs 1/3/5) | none |
| tests/returns.test.ts | 4 | IRR, MIRR, equity multiple, cash-flow series construction | Hand-verified golden values | none |
| tests/capitalstack.test.ts | 7 | Multi-tranche waterfall, weighted average cost | Hand-verified | none |
| tests/portfolio.test.ts | 8 | Pooled cash flow, portfolio IRR, concentration risk | Hand-verified (post `544ad82` pooling fix) | none |
| tests/amortization.test.ts | 13 | Full schedule, tranche schedule, remaining balance | Hand-verified month-60 balance; published $599.55/mo reference | none |
| tests/exit.test.ts | 12 | Sale price (flat-growth & cap-rate), exit proceeds, full-cycle IRR | Hand-verified, cross-checked against E8/E9 outputs | none |
| tests/portfolio-rollup.test.ts | 10 | Rollup aggregation, cash-flow-series construction gap handling | References "Doc 54 E10" gap directly | none |
| tests/appreciation.test.ts | 10 | Flat/compound appreciation projection | Hand-verified | none |
| tests/break-even.test.ts | 19 | Break-even down payment, break-even monthly payment | FCAC-referenced | none |
| tests/ptt.test.ts | 21 | BC PTT brackets, FTHB exemptions, surcharge, US PTT | BC statutory PTT schedule, "Template v2" reference case | none |
| tests/refinance.test.ts | 13 | Refinance proceeds, new payment, cash-out | FCAC-referenced | none |
| tests/scenario.test.ts | 20 | Multi-scenario comparison, best/worst outcome selection | Hand-verified | none |
| tests/brrrr.test.ts | 13 | BRRRR cycle math, refinance-out, capital recycled | Hand-verified | none |
| tests/holding-period-sensitivity.test.ts | 18 | Multi-year hold sensitivity, gross equity recoverability | Internally derived from appreciation model (documented) | none |
| tests/tax-optimization.test.ts | 30 | Tax optimization scenarios, summary/field consistency | Self-validated, internal-consistency check | none |
| tests/data-provenance.test.ts | 29 | Provenance tracking, confidence labeling, staleness | Self-validated against documented (partially spec-underdetermined) rules | none |
| tests/fx-conversion.test.ts | 21 | Currency conversion, FX sensitivity bands | Hand-verified against E23 spec rule | none |
| tests/rental-waterfall.test.ts | 24 | Unit-level rent ramp, vacancy, monthly/annual rollup | Self-validated arithmetic reconciliation | none |
| **Total** | **300** | | | **0 skipped, 0 failing** |

**Not represented by any test file** (E25–E28): `property-tax.ts`, `opex-benchmark.ts`, `insurance-estimation.ts`, `lender-scorecard.ts`. **Also untested**: `chart-data.ts` and `amortization-display.ts` have no dedicated test file (E14's schedule logic is only indirectly exercised through consumers, if at all).

No `xit()`, `.skip()`, `xdescribe()`, or `todo()` calls exist anywhere in `tests/` — every test that exists runs and passes. The gap is entirely in **missing test files**, not disabled tests within existing files.

---

## Task 4: Build Completeness Matrix (E1–E28)

Confidence key: **✓** = confirmed via inline code/test comment; *(inferred)* = positional inference from commit-message bucket, internally consistent; *(unverified)* = bucket-confirmed only, exact slot unknown.

| E# | Engine (best available name) | TS File(s) | Test File(s) | Tests | Status | Critical Issues | Action Items |
|---|---|---|---|---:|---|---|---|
| E1 | Mortgage payment calculator | mortgage.ts *(inferred)* | mortgage.test.ts | 2 | ✅ Built & Tested | Thin coverage (2 tests) relative to 4 exports | Week 2: add edge-case tests (zero-rate, max amortization) |
| E2 | Amortization schedule (base) | amortization.ts *(inferred)* | amortization.test.ts | 13 | ✅ Built & Tested | none | — |
| E3 | Cash flow projection (base) | cashflow.ts *(inferred)* | cashflow.test.ts | 12 | ✅ Built & Tested | none | — |
| E4 | Exit sale price | exit.ts *(inferred)* | exit.test.ts | 12 | ✅ Built & Tested | none | — |
| E5 | IRR/MIRR/equity multiple | returns.ts *(inferred)* | returns.test.ts | 4 | ✅ Built & Tested | Only 4 tests for 4 exports | Week 1: expand MIRR/equity-multiple edge cases |
| E6 | *(one of: Qualifying/DSCR/CapitalStack/Portfolio/Break-Even/Chart Data)* | unverified | — | — | ⚠️ Mapping unverified | Cannot confirm exact file without spec doc | Week 1: obtain Doc 78/spec to reconcile |
| E7 | *(one of: Qualifying/DSCR/CapitalStack/Portfolio/Break-Even/Chart Data)* | unverified | — | — | ⚠️ Mapping unverified | same | same |
| E8 | Per-tranche amortization schedule | amortization.ts ✓ | amortization.test.ts | 13 (shared w/ E2) | ✅ Built & Tested | none | — |
| E9 | Real-path debt service in cash flow projection | cashflow.ts ✓ | cashflow.test.ts | 12 (shared w/ E3) | ✅ Built & Tested | none | — |
| E10 | Full-cycle exit proceeds/IRR composition | exit.ts *(inferred)* | exit.test.ts | 12 (shared w/ E4) | ✅ Built & Tested | none | — |
| E11 | *(one of: Qualifying/DSCR/CapitalStack/Portfolio/Break-Even/Chart Data)* | unverified | — | — | ⚠️ Mapping unverified | same | same |
| E12 | BC/US Property Transfer Tax | ptt.ts ✓ | ptt.test.ts | 21 | ✅ Built & Tested | Not exported from index.ts | Week 1: add to public API surface |
| E13 | *(one of: Qualifying/DSCR/CapitalStack/Portfolio/Break-Even/Chart Data)* | unverified | — | — | ⚠️ Mapping unverified | same | same |
| E14 | Amortization display (monthly/annual views) | amortization-display.ts ✓ | **none** | 0 | ⚠️ Partial/Buggy (built, untested) | No dedicated test file | Week 1: write amortization-display.test.ts |
| E15 | *(one of: Qualifying/DSCR/CapitalStack/Portfolio/Break-Even/Chart Data)* | unverified | — | — | ⚠️ Mapping unverified | same | same |
| E16 | Property appreciation projection | appreciation.ts *(inferred)* | appreciation.test.ts | 10 | ✅ Built & Tested | none | — |
| E17 | Refinance analysis | refinance.ts *(inferred)* | refinance.test.ts | 13 | ✅ Built & Tested | Not exported from index.ts | Week 1: add to public API surface |
| E18 | Scenario comparison | scenario.ts ✓ | scenario.test.ts | 20 | ✅ Built & Tested | none | — |
| E19 | BRRRR modeling | brrrr.ts ✓ | brrrr.test.ts | 13 | ✅ Built & Tested | Field extends beyond documented spec scope (by design) | Week 2: reconcile with spec doc |
| E20 | Holding period sensitivity | holding-period-sensitivity.ts *(inferred)* | holding-period-sensitivity.test.ts | 18 | ✅ Built & Tested | none | — |
| E21 | Tax optimization | tax-optimization.ts *(inferred)* | tax-optimization.test.ts | 30 | ✅ Built & Tested | Self-validated only, no external tax-authority reference | Week 2: seek external validation source |
| E22 | Data provenance / confidence tracking | data-provenance.ts ✓ | data-provenance.test.ts | 29 | ✅ Built & Tested | Confidence-band thresholds not fully spec'd (documented) | Week 1: confirm thresholds with spec owner |
| E23 | FX conversion & sensitivity | fx-conversion.ts ✓ | fx-conversion.test.ts | 21 | ✅ Built & Tested | none | — |
| E24 | Rental waterfall | rental-waterfall.ts *(inferred)* | rental-waterfall.test.ts | 24 | ✅ Built & Tested | Self-validated only; not exported from index.ts | Week 1: add to public API surface |
| E25 | Property tax estimator | property-tax.ts ✓ | **none** | 0 | ⚠️ Partial/Buggy (built, untested) | Zero automated verification | Week 1: write property-tax.test.ts (author-acknowledged gap) |
| E26 | OpEx benchmark estimator | opex-benchmark.ts ✓ | **none** | 0 | ⚠️ Partial/Buggy (built, untested) | Zero tests + undocumented per-category rates | Week 1: write tests; resolve spec gap on category rates |
| E27 | Insurance estimation | insurance-estimation.ts ✓ | **none** | 0 | ⚠️ Partial/Buggy (built, untested) | Zero tests; 2 unused input fields in public interface | Week 1: write tests; remove or wire up dead fields |
| E28 | Lender scorecard | lender-scorecard.ts ✓ | **none** | 0 | ⚠️ Partial/Buggy (built, untested) | Zero tests; unresolved spec ambiguity on Borderline case | Week 1: write tests; resolve spec ambiguity |

No E# in the 1–28 range is fully **❌ Absent** — every number has at least a plausible file mapping. Nothing is marked **🔄 Deferred** in this repo; the commit history shows no explicit deferrals within E1-E28 (Phase 2 is described as a separate downstream milestone — WeWeb+Supabase MVP — not a deferred engine number).

---

## Task 5: Summary Statistics

| Metric | Value |
|---|---:|
| Total `.ts` source files (non-test, excl. `index.ts`) | 26 |
| Total `.ts` source files (incl. `index.ts`) | 27 |
| Total test files | 22 |
| Total test cases | 300 |
| Total lines of code — source (`src/*.ts`) | 3,665 |
| Total lines of code — tests (`tests/*.ts`) | 3,861 |
| **Total lines of code (source + tests)** | **7,526** |
| Engines fully complete (built + tested, no critical issues) | 17 of 28 E-slots (E1–E5, E8–E10, E12, E16, E18, E20, E22–E23; E17/E21/E24 built+tested but with a minor issue each) |
| Engines partial (built, gaps — untested) | 5 (E14, E25, E26, E27, E28) |
| Engines with unverified/unmapped E# slot (built, but exact E# unconfirmed — 6 files exist: qualifying, dscr, capitalstack, portfolio, break-even, chart-data) | 4 numeric slots (E6, E7, E11, E13, E15) short by 2 against 6 candidate files — see methodology note |
| Engines absent (spec number with zero code anywhere) | 0 |
| Engines deferred (intentionally, per commit history) | 0 |

Note on the "fully complete" count: of the 22 files with passing tests, 3 (break-even.ts, ptt.ts, rental-waterfall.ts, refinance.ts — 4 actually) are functionally complete and tested but not exposed via `index.ts`'s public export list, which is a packaging gap rather than an engine defect. See Task 6.

---

## Task 6: Critical Issues Report

### 1. Author-flagged markers (TODO/FIXME/BUG/CRITICAL/BLOCKER)
**None found.** Full-repository grep across `src/` and `tests/` for these tokens returned zero matches. This is a genuinely clean codebase by that measure — no self-flagged unfinished work was left in comments.

### 2. Zero test coverage — E25, E26, E27, E28 (property-tax, opex-benchmark, insurance-estimation, lender-scorecard)
All four were built in the same commit (`9ec9e9b`) whose own message states "[tests pending]" for this group. `npm test` currently reports 300/300 passing, but that number reflects **zero coverage** for these four engines — they simply have no test file to run. This is the single highest-priority gap in the repo: shipped, uncompiled-into-dist, and unverified calculation logic.

### 3. Zero test coverage — chart-data.ts and amortization-display.ts (E14 and its consumer)
Not part of the acknowledged E25-E28 gap, but no `chart-data.test.ts` or `amortization-display.test.ts` exists. `chart-data.ts` in particular transforms other engines' outputs into UI-ready series and has no correctness check of its own.

### 4. Public API surface covers less than half the built engines
`src/index.ts` re-exports only 13 functions from 6 files (mortgage, cmhc, qualifying, dscr, cashflow, returns, capitalstack, portfolio, exit, amortization). The other 17 source files — including fully tested engines like `ptt.ts` (21 tests), `refinance.ts` (13 tests), `rental-waterfall.ts` (24 tests), `scenario.ts` (20 tests), `tax-optimization.ts` (30 tests) — are unreachable by anything that imports `investscape-calc-engine` by package name rather than by deep file path. Anything consuming the compiled package today gets a small fraction of what's built and tested.

### 5. Stale build artifact
`dist/` (local, gitignored) reflects source as of before the `9ec9e9b` commit — it's missing all 17 files added in Phase 1. `npm run build` needs to be re-run; this repo's `package.json` `main`/`types` fields point at `dist/index.js`/`dist/index.d.ts`, so any downstream consumer pulling from a published build of this package right now would be missing everything past E10/E12.

### 6. No missing-function cross-reference issues found
Grep across `src/` for exported function names referenced but not defined found no dangling references; `npx tsc --noEmit` compiles clean with zero errors, which would have caught this class of issue.

### 7. No commented-out logic or dead mathematical branches found
No blocks of commented-out code were found in any `src/*.ts` file.

### 8. Historical bug — already fixed, not currently open
Commit `544ad82` documents that `portfolio.ts`'s IRR was previously computed by **averaging** per-property IRRs instead of correctly **pooling** cash flows and solving once — a real, meaningful methodology bug. It was fixed prior to this audit (referenced as "DERIVED-THIN fix per Doc 54 Step 1") and current tests (`portfolio.test.ts`, `portfolio-rollup.test.ts`) reflect the corrected behavior. Flagged here for the record, not as an open issue.

### 9. Validation-basis split: not all "validated" engines are validated against the same standard
Of the 22 tested engines, only a subset cite an external/regulatory reference (FCAC, OSFI, CMHC, BC statutory PTT brackets): mortgage, cmhc, qualifying, break-even, refinance, ptt. The remainder (dscr, tax-optimization, rental-waterfall, and others) are validated only by internal arithmetic-consistency checks — correct relative to their own formulas, but not cross-checked against any external source of truth. This distinction matters for anything downstream that assumes "tested" implies "regulator-verified."

### 10. Spec document unavailable in-repo
Every doc-comment referencing "the E## spec" is citing a document that does not exist anywhere in this repository — `investscape-docs/` is an empty directory, and no "Doc 78," "Doc 54," or similar file could be located via filesystem search or git history search. This audit's E1–E28 mapping (Task 4) is therefore reconstructed evidence, not a lookup against ground truth, for roughly 20% of the slots (E6, E7, E11, E13, E15). Recommend the actual spec doc be added to this repo (e.g., under `investscape-docs/`) so future audits don't need to reverse-engineer it from commit messages.

---

## Discrepancies with July 31 Audit (Doc 78)

**Doc 78 could not be located.** A search of the full git history (`git log --all --diff-filter=A -- investscape-docs`), the current working tree, and a filesystem-wide search for filenames containing "doc" + "78" found no matching file anywhere accessible from this repository. `investscape-docs/` exists as a directory but is and — per `git log` — has always been empty in this repo's history; no commit ever added a file into it.

What **can** be reconstructed from git history as of the last commit before today (`1a33d40`, dated prior to the Aug 2/Aug 4 work) — i.e., the likely state as of "July 31" — versus the current `9ec9e9b` HEAD:

| Area | State as of ~July 31 (commit `1a33d40` and earlier) | State now (`9ec9e9b`, Aug 4) |
|---|---|---|
| Engines with code | mortgage, cmhc, qualifying, dscr, cashflow, returns, capitalstack, portfolio (8 files) | 27 files (+19) |
| Tests passing | ~135 (sum of individual commit counts through `407a626`'s "33 golden tests" milestone, plus later additions) | 300 |
| E8/E9/E10 (tranche amort / real cashflow / exit composition) | not yet built | built (`f90e187`, Aug 2) and tested |
| E11–E24 (capital stack refinements, break-even, PTT, scenarios, tax/provenance/FX/rental) | not yet built | built and tested (`9ec9e9b`, Aug 4) |
| E25–E28 (property tax, opex benchmark, insurance, lender scorecard) | not yet built | built, **tests still pending** (author-acknowledged) |
| Known bugs | portfolio IRR averaging bug (fixed same period, `544ad82`) | none currently open |
| dist/ build freshness | in sync with source | **stale** — 17 files behind current `src/` |

Since Doc 78 itself is unavailable, this table is a best-effort reconstruction from `git log`, not a diff against the actual prior audit document. If Doc 78 exists outside this repository (e.g., in a separate docs system, Notion, Google Docs), it should be supplied directly for a precise discrepancy comparison — in particular to resolve the E6/E7/E11/E13/E15 mapping ambiguity flagged throughout this report.

---

*End of audit. Raw test output: `TEST-RESULTS-AUG-4-2026.txt`. Generated by Claude Code on 2026-08-04.*
