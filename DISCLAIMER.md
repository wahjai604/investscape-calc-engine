# Legal Disclaimer — InvestScape Calculation Engine

## Information-Only Software

This software provides **calculation and analysis tools for real estate investment evaluation**. It does not constitute:

- Legal advice
- Financial advice
- Investment recommendations
- Tax advice

Consult qualified professionals (lawyer, accountant, CPA, financial advisor) before making investment decisions.

## No Warranty

This software is provided "as-is" without warranty, express or implied, including but not limited to:
- Fitness for a particular purpose
- Accuracy or completeness of calculations
- Non-infringement of third-party rights

Automated test coverage does not exceed 99.06% of lines (see [README.md](README.md) for current test and coverage figures); two engines (E26, E27) do not currently have dedicated unit tests. Users are responsible for independently verifying calculation results before relying on them.

**E71–E72 (syndication waterfall) specifically:** the preferred return rate, GP catch-up percentage, and IRR-hurdle tier table are documented industry defaults, not universal or legally required terms — every real syndication negotiates its own operating agreement, and this software does not verify that any deal's actual LP/GP agreement matches what was entered. See `docs/SYNDICATION-WATERFALL-SOURCES.md` for what each default is sourced from and its documented limitations, including a known simplification in how the IRR-hurdle tier is selected when a single distribution would otherwise cross a hurdle boundary mid-period.

**E73–E77 (US mortgage qualifying) specifically:** there is no US equivalent of a Canadian-style rate-based stress test — the 2021 CFPB rule replaced it with a lender-side compliance test, not a borrower-facing number, so none is modeled here. The DTI compensating-factor thresholds, PMI rate tables, and DSCR-loan minimums are **composed to reproduce sourced overall ranges**, not literal single-lender rate cards — see `docs/US-QUALIFIER-SOURCES.md` for exactly which figures are directly cited vs. derived/composed, and re-verify FHA MIP tiers specifically before relying on them (these change periodically via HUD Mortgagee Letters). The 75% qualifying-rental-income rule only implements the lease-based path (Fannie Mae B3-3.8-01); it correctly refuses to compute qualifying rental income without a signed lease rather than estimating one.

## Limitation of Liability

In no event shall Lighthouse Research Ltd. be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising from use of this software.

## Jurisdiction

This software is provided under the laws of Canada and the United States. Users assume all liability for their own investment decisions.

## Contact

For legal inquiries: wahjai604@gmail.com

---

© 2026 Lighthouse Research Ltd. All rights reserved.
