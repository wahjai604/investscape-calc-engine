# InvestScape Calculation Engine

**Repository:** https://github.com/wahjai604/investscape-calc-engine
**License:** Proprietary (Closed-Source) — see [LICENSE](LICENSE)
**Copyright:** © 2026 Lighthouse Research Ltd.

## Purpose

A TypeScript calculation engine for real estate investment analysis: mortgage math, cash flow, investment returns, and related property-analysis engines.

## Scope

35 engines, **E1–E28, E71–E77**:

| Range | Engines |
|---|---|
| E1–E5 | Mortgage calculation, amortization schedules, cash flow modeling, exit analysis, investment returns (IRR, MIRR) |
| E6–E11 | Mortgage qualification (GDS/TDS), CMHC insurance premiums, capital stack (WACC), DSCR, portfolio rollup, BC property transfer tax |
| E12–E21 | Break-even analysis, appreciation forecasting, refinance recommendations, scenario comparison, BRRRR strategy, holding-period sensitivity, tax optimization, data provenance, FX conversion (CAD/USD), rental waterfall |
| E22–E27 | Property tax (BC/ON/AB), operating expense benchmarks, insurance estimation, lender scorecard, amortization display, chart data |
| E28 | Sales price appreciation (flat growth and cap rate methods) |
| E71–E72 | Syndication (LP/GP) distribution waterfall — American/deal-by-deal only — and its isolated GP catch-up formula |
| E73–E77 | US mortgage qualifying: DTI stress tiers + conforming loan limit, FHA MIP, conventional PMI, loan-convention DSCR (distinct from E9's commercial DSCR), and the Fannie Mae 75% qualifying-rental-income rule |

Also present but **not E-numbered** (typed contracts only, not implemented — see each file's own header): `src/phase2-scaffolds-str.ts`, `src/phase2-scaffolds-climate-risk.ts`.

Full function-level detail: `src/index.ts` and `src/E*.ts`. E71–E72's sourced conventions are documented in `docs/SYNDICATION-WATERFALL-SOURCES.md`; E73–E77's in `docs/US-QUALIFIER-SOURCES.md`.

This repo's E-numbers are not contiguous with E29 onward — those live in sibling repos that share the same flat, append-only E-number sequence: E29–E45 (`investscape-economic-engine`), E46–E53 and E68–E70 (`investscape-tax-engine` — Canada/US rental tax, plus US-only 1031 exchange/cost segregation/Opportunity Zones), and E54–E67 (`investscape-market-intelligence-engine`). See `investscape-docs`' canonical registry for the authoritative next-available number before adding a new engine anywhere in the family.

**Jurisdictions implemented:** Canada and US at the country level (`"Canada" | "US"`). Canadian province-specific tax rates are hardcoded for **BC, ON, and AB only**. US states are free-text fields, not a validated enum — no state-specific rules are currently implemented. BC Property Transfer Tax (E11) is BC-specific; other provinces return null.

## Testing

- **Test suites:** 36
- **Test cases:** 473
- **Passing:** 473/473 (100%)
- **Coverage** (via `npx jest --coverage`): 98.41% statements, 94.25% branches, 98.94% functions, 99.06% lines. No coverage threshold is currently enforced in `jest.config.js`. E71–E77 are each at 100% statements/functions/lines; E75's one uncovered branch is a defensive fallback for a credit score below zero, which can't occur with valid input.
- **Note:** E26 (amortization display) and E27 (chart data) do not have dedicated unit test files; their coverage numbers above come from incidental exercise via other tests, not direct unit tests.

```bash
npm test
```

## Installation

For authorized users only. Usage requires a valid InvestScape tier (S1–S3).

```bash
npm install
npm test
```

## Architecture

Each engine lives in its own `src/E{n}-{name}.ts` file with a matching `src/types/E{n}.types.ts` type definitions file. All engines are re-exported from `src/index.ts`. Shared constants live in `src/utils/constants.ts`.

## Documentation

Reference documentation: https://github.com/wahjai604/investscape-docs

Sourced conventions behind E71–E72 (preferred return, IRR-hurdle tiers, and — most importantly — the GP catch-up grossed-up formula and its common miscalculation) are in [`docs/SYNDICATION-WATERFALL-SOURCES.md`](docs/SYNDICATION-WATERFALL-SOURCES.md).

Sourced conventions behind E73–E77 (DTI tiers, FHA MIP, conventional PMI, DSCR-loan minimums, the 75% rental-income rule, and every composed/derived figure vs. directly-cited one) are in [`docs/US-QUALIFIER-SOURCES.md`](docs/US-QUALIFIER-SOURCES.md).

## License & Disclaimer

This software is closed-source proprietary code. Authorized users only.

For legal disclaimers, see [DISCLAIMER.md](DISCLAIMER.md).

---

© 2026 Lighthouse Research Ltd. All rights reserved.
