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

Automated test coverage does not exceed 98.95% of lines (see [README.md](README.md) for current test and coverage figures); two engines (E26, E27) do not currently have dedicated unit tests. Users are responsible for independently verifying calculation results before relying on them.

**E71–E72 (syndication waterfall) specifically:** the preferred return rate, GP catch-up percentage, and IRR-hurdle tier table are documented industry defaults, not universal or legally required terms — every real syndication negotiates its own operating agreement, and this software does not verify that any deal's actual LP/GP agreement matches what was entered. See `docs/SYNDICATION-WATERFALL-SOURCES.md` for what each default is sourced from and its documented limitations, including a known simplification in how the IRR-hurdle tier is selected when a single distribution would otherwise cross a hurdle boundary mid-period.

## Limitation of Liability

In no event shall Lighthouse Research Ltd. be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising from use of this software.

## Jurisdiction

This software is provided under the laws of Canada and the United States. Users assume all liability for their own investment decisions.

## Contact

For legal inquiries: wahjai604@gmail.com

---

© 2026 Lighthouse Research Ltd. All rights reserved.
