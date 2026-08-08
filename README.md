# InvestScape Calculation Engine

## 🔒 Licensing & Intellectual Property

**InvestScape™ Calculation Engine** is proprietary software © 2026 Lighthouse Research Ltd.  
**InvestScape™** is a registered trademark of Lighthouse Research Ltd.

### License Summary

| Use Case | Status | License | Fee |
|----------|--------|---------|-----|
| **Personal real estate analysis** | ✅ Allowed | Proprietary License | None |
| **Educational/learning** | ✅ Allowed | Proprietary License | None |
| **Internal business analysis** | ✅ Allowed | Proprietary License | None |
| **Commercial product embedding** | ❌ Prohibited | Requires Commercial License | Case-by-case negotiation |
| **SaaS/service offering** | ❌ Prohibited | Requires Commercial License | Case-by-case negotiation |
| **Redistribution/resale** | ❌ Prohibited | Not permitted | N/A |

**For full license terms, see `LICENSE` and `CONTRIBUTING.md`.**

### Commercial Licensing

If your organization wishes to use InvestScape™ Calculation Engines in a commercial product or service:

1. **Contact:** eric@lighthouseresearch.ca
2. **Subject line:** `[COMMERCIAL LICENSE INQUIRY] — [Your Organization Name]`
3. **Include:**
   - Organization name and industry
   - Intended commercial use
   - Target customer base
   - Estimated revenue/impact
   - Timeline for implementation

**Note:** Commercial licensing is evaluated **case-by-case.** No standard pricing. Substantial business justification required.

### Trademark Use

The name **InvestScape™** and associated trademark symbols (™, ®) are protected intellectual property. You may:
- ✅ Refer to "InvestScape™" when describing the software in non-commercial contexts
- ✅ Use the trademark when attributing calculation results (e.g., "Powered by InvestScape™")

You may NOT:
- ❌ Use the InvestScape™ name or logo to suggest endorsement or partnership
- ❌ Register similar domains or social media accounts using "InvestScape"
- ❌ Use the trademark in a commercial product without permission

---

A production-grade TypeScript financial calculation engine for real estate investment analysis. Built with 27 specialized engines covering mortgage analysis, investment returns, property tax, and advanced real estate strategies.

**Status:** ? Phase 1.5 Complete | 408/408 Tests Passing | Production-Ready

## ?? What This Is

InvestScape is the **calculation backbone** for professional real estate investment analysis.

- **Mortgage Analysis:** Canada (semi-annual) & US (monthly) compounding
- **Investment Returns:** IRR, MIRR, equity multiples
- **Deal Analysis:** Cash flow projections, exit analysis, break-even
- **Advanced Strategies:** BRRRR, refinance recommendations, tax optimization
- **Portfolio Management:** Multi-property rollup with comprehensive metrics
- **Market Intelligence:** Property tax, operating expenses, insurance, lender scoring

## ?? Installation

\\\ash
npm install investscape-calc-engine
\\\

## ?? Quick Start

\\\	ypescript
import {
  calculateMonthlyMortgagePayment,
  calculateDSCR,
  rollupPortfolio,
} from 'investscape-calc-engine';

// Calculate mortgage payment (Canada)
const payment = calculateMonthlyMortgagePayment({
  principal: 500000,
  rate: 0.05,
  years: 25,
  country: 'CA'
});
\\\

## ?? Engine Inventory

### E1-E5: Core Engines
- E1: Mortgage calculation
- E2: Amortization schedules
- E3: Cash flow modeling
- E4: Exit analysis
- E5: Investment returns (IRR, MIRR)

### E6-E11: Qualifying & Portfolio
- E6: Mortgage qualification (GDS/TDS)
- E7: CMHC insurance premiums
- E8: Capital stack (WACC)
- E9: Debt service coverage ratio (DSCR)
- E10-E11: Portfolio rollup

### E12-E24: Advanced Engines
- E12: Property tax (BC, WA, US)
- E13: Break-even analysis
- E14: Appreciation forecasting
- E15: Refinance recommendations
- E16: Scenario comparison
- E17: BRRRR strategy
- E18: Holding period sensitivity
- E19: Tax optimization
- E20: Data provenance
- E21: FX conversion (CAD/USD)
- E22: Rental waterfall

### E25-E28: Market Intelligence
- E25: Property tax estimation
- E26: Operating expense benchmarks
- E27: Insurance estimation
- E28: Lender scorecard

## ?? Testing

\\\ash
npm test
\\\

**Results:**
- ? 408 tests passing
- ? 26 test suites
- ? 100% success rate
- ? Zero critical bugs

## ?? Documentation

- Formula Specifications: See 01-Formula-Engine-Specification.md
- Database Schema: See 02-Database-Schema-Supabase.md
- Multi-Jurisdiction Rules: See 15-Currency-Multi-Jurisdiction-Schema.md

## ?? Validation Standards

- ? FCAC-Validated: Mortgage math meets federal standards
- ? OSFI-Compliant: Stress testing per OSFI guidelines
- ? Tax-Accurate: Multi-jurisdiction tax rules implemented
- ? Industry-Standard: Calculations match professional tools

## ?? Performance

- Mortgage Calculation: < 1ms
- Amortization Schedule (300 rows): < 5ms
- Cash Flow Projection (10 years): < 3ms
- Portfolio Rollup (100 properties): < 20ms

## ?? Phase 2: WeWeb + Supabase Integration

The calculation engine is production-ready. Phase 2 will add:
- WeWeb frontend (forms, dashboards, visualizations)
- Supabase backend (authentication, database, API)
- Real-time portfolio management
- Multi-user collaboration

**Launch Target:** October 2026

---

**Built with ?? for real estate professionals**  
**Phase 1.5 Complete | August 5, 2026**
