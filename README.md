# InvestScape Calculation Engine

**Repository:** https://github.com/wahjai604/investscape-calc-engine
**License:** Proprietary (Closed-Source) — see [LICENSE](LICENSE)
**Copyright:** © 2026 Lighthouse Research Ltd.

## Purpose

A TypeScript calculation engine for real estate investment analysis: mortgage math, cash flow, investment returns, and related property-analysis engines.

## Scope

28 engines, **E1–E28**:

| Range | Engines |
|---|---|
| E1–E5 | Mortgage calculation, amortization schedules, cash flow modeling, exit analysis, investment returns (IRR, MIRR) |
| E6–E11 | Mortgage qualification (GDS/TDS), CMHC insurance premiums, capital stack (WACC), DSCR, portfolio rollup, BC property transfer tax |
| E12–E21 | Break-even analysis, appreciation forecasting, refinance recommendations, scenario comparison, BRRRR strategy, holding-period sensitivity, tax optimization, data provenance, FX conversion (CAD/USD), rental waterfall |
| E22–E27 | Property tax (BC/ON/AB), operating expense benchmarks, insurance estimation, lender scorecard, amortization display, chart data |
| E28 | Sales price appreciation (flat growth and cap rate methods) |

Full function-level detail: `src/index.ts` and `src/E*.ts`.

**Jurisdictions implemented:** Canada and US at the country level (`"Canada" | "US"`). Canadian province-specific tax rates are hardcoded for **BC, ON, and AB only**. US states are free-text fields, not a validated enum — no state-specific rules are currently implemented. BC Property Transfer Tax (E11) is BC-specific; other provinces return null.

## Testing

- **Test suites:** 27
- **Test cases:** 410
- **Passing:** 410/410 (100%)
- **Coverage** (via `npx jest --coverage`): 97.97% statements, 93.25% branches, 98.74% functions, 98.84% lines. No coverage threshold is currently enforced in `jest.config.js`.
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

## License & Disclaimer

This software is closed-source proprietary code. Authorized users only.

For legal disclaimers, see [DISCLAIMER.md](DISCLAIMER.md).

---

© 2026 Lighthouse Research Ltd. All rights reserved.
