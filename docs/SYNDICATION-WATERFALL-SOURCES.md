# Syndication Waterfall (E71–E72) — Sourced Conventions

**As of August 2026.** These are real-estate-syndication industry conventions gathered from live research, not codified law — unlike a tax bracket, there is no single authoritative source. Every default here is documented as **a common default, not a universal rule**: real deals negotiate their own preferred return, catch-up percentage, and tier structure in the LP/GP operating agreement. This engine's job is to compute correctly *given* those negotiated terms, not to enforce what they should be.

---

## ⚠️ Read this before touching E72 or the catch-up logic in E71

**The GP catch-up calculation is, per the sourced research, the single most commonly miscalculated provision in this entire domain.** The mistake is almost always the same one, and it's easy to reach for by accident:

```
WRONG:   catchUpAmount = preferredDistribution * gpCatchUpPercent
CORRECT: catchUpAmount = (preferredDistribution / (1 - gpCatchUpPercent)) * gpCatchUpPercent
```

**Why the wrong formula is wrong.** `gpCatchUpPercent` (e.g. 20%) is GP's target share of the **combined** (preferred + catch-up) pool, not of the preferred distribution alone. If GP's catch-up is supposed to bring them to 20% of the total profit pool paid out through the end of the catch-up tier, then:

```
catchUpAmount / (preferredDistribution + catchUpAmount) = gpCatchUpPercent
```

Solving for `catchUpAmount` algebraically gives the grossed-up formula above. The flat-percentage shortcut instead computes 20% of *just* the preferred number, which — after adding it back to preferred — leaves GP under their actual 20% target (16 / (80 + 16) = 16.7%, not 20%). It looks plausible, it compiles, it passes a superficial glance, and it silently underpays GP on every single deal that uses it. This is why E72 exists as its own file with its own isolated test suite, rather than being inlined into E71's tier-processing loop: a one-line regression that reintroduces the flat-percentage bug should be caught by `__tests__/E72-gp-catchup.test.ts` in isolation, without needing to reason about the rest of the waterfall's state machine.

**The golden test** (`calculateGrossedUpCatchUpTarget(80, 0.2)` must equal `20`, and there is an explicit test asserting the result is *not* `16`) is the canary. If that test ever needs to change to make a new implementation pass, stop and re-derive the formula from the ratio identity above — don't just update the expected value.

---

## Preferred return

**Value:** `DEFAULT_PREFERRED_RETURN_RATE = 0.08` (8%).

**Source:** Real 2026 syndication preferred returns typically range 6–9%, with 8% the single most common point default across sourced deal structures. Always overridable via `SyndicationWaterfallInput.preferredReturnRate`.

**Compounding, not simple interest.** The preferred return is cumulative and **compounding**: unpaid preferred return itself accrues the preferred rate in subsequent periods, not just the outstanding capital balance. Each period, before any cash is distributed:

```
interestThisPeriod = (capitalBalance + preferredBalanceOwed) * preferredReturnRate
preferredBalanceOwed += interestThisPeriod
```

This is the standard distinction between simple and compound interest: simple interest would apply the rate to the *original* capital only, so an unpaid preferred balance would just accumulate linearly. Compounding means a shortfall in one period makes the next period's accrual larger — see the "Compounding vs. simple" test in `__tests__/E71-syndication-waterfall.test.ts` for a worked multi-period example where this visibly diverges from the simple-interest number.

---

## GP catch-up target

**Value:** `DEFAULT_GP_CATCHUP_PERCENT = 0.20` (20%).

**Source:** Falls inside the typical 15–25% GP promote range (see below) documented in the sourced research as a common target for GP's ultimate share of the (preferred + catch-up) pool once catch-up is complete.

**Gating.** Catch-up only activates once return of capital **and** preferred return are *fully* satisfied cumulatively (`capitalBalance === 0 && preferredBalanceOwed === 0`) — strict tier order, no partial-tier bleed-through. A period that only partially pays down preferred does not trigger any catch-up that period, even if there's leftover cash after the partial preferred payment (there won't be, by construction — see E71's tier loop).

**Carry-forward.** An unpaid catch-up shortfall is tracked the same way unpaid preferred is: `catchUpTargetCumulative` is recomputed against the latest `cumulativePreferredPaidToDate` each period, `cumulativeCatchUpAlreadyPaid` is subtracted off, and the remainder is capped by that period's available cash. Nothing is dropped.

---

## GP promote range

**Values:** `DEFAULT_GP_PROMOTE_RANGE_MIN = 0.15`, `DEFAULT_GP_PROMOTE_RANGE_MAX = 0.25`.

These are documentation/rationale constants, not wired into a single formula on their own. They record that both `DEFAULT_GP_CATCHUP_PERCENT` (20%) and the first promote-bearing tier's GP split in `DEFAULT_WATERFALL_TIERS` (also 20%, in the 8–12% IRR tier) fall inside the sourced 15–25% real-world range for GP promotes above the first hurdle. If you change one of those two defaults, sanity-check it against this range (or update the range itself, with a note on why).

---

## IRR-hurdle tier table

**Value:** `DEFAULT_WATERFALL_TIERS`:

| irrHurdle (upper bound, exclusive) | lpSplit | gpSplit |
|---|---|---|
| 8% | 100% | 0% |
| 12% | 80% | 20% |
| 15% | 70% | 30% |
| ∞ (open-ended top tier) | 50% | 50% |

**Source:** A real, sourced example structure — explicitly documented in the source research as **a default, not a universal rule**. "No formula is universal; deals are individually negotiated" is the research's own framing, and it's carried through here: `tiers` is a required-or-defaulted input, never hardcoded into the calculation itself.

**IRR vs. equity multiple.** ~85% of real waterfalls use IRR (not equity multiple) as the hurdle metric per the sourced research, so IRR-based tiers are the v1 default. Equity-multiple hurdles are a documented Phase 2 alternative — not built now, and `WaterfallTier` has no equity-multiple field to retrofit against later without a breaking change.

**How tier selection actually works (a documented simplification).** A fully accurate IRR-hurdle waterfall would, in principle, split a single period's tier-4 cash across multiple tiers if the incremental distribution pushes the LP's cumulative IRR across a hurdle boundary mid-period. Computing that split point requires an iterative search (the LP's achieved IRR is itself only knowable by running Newton-Raphson against the cash-flow-so-far series, and "so far" would need to include a hypothetical partial current-period distribution). E71 does not do this. Instead, it resolves **one tier per period**: the LP's achieved IRR is computed from all *prior* periods' finalized distributions plus the *current* period's return-of-capital and preferred-return payments (but not yet including any tier-4 money), and whichever tier that IRR falls into is applied to the **entire** remaining cash for that period's tier 4. Tier transitions therefore take effect at period boundaries, not intra-period. This means, in practice, that if a single large distribution would have crossed two hurdle bands in one shot, this engine puts the whole amount in the lower band's tier for that period, and the higher band only takes effect starting the *next* cash flow period. Document this to any user comparing output against a hand-built spreadsheet that assumes intra-period sub-splitting — the two will diverge on that one specific pattern (small periods with a hurdle boundary crossed mid-distribution), even though every other number reconciles.

**Malformed tiers.** If a tier's `lpSplit + gpSplit` doesn't sum to 1.0, `calculateSyndicationWaterfall` normalizes it (rescales both by the sum) so the period's cash is still fully allocated, and records the problem in `issues[]`. It does not throw, and it does not silently drop or invent cash.

---

## Scope: American (deal-by-deal) only

This engine models a single deal's own waterfall — capital in, distributions out, LP/GP splits computed against that one deal's cash flows. It does **not** model a European/whole-fund waterfall, where the GP's promote is computed at the fund level across multiple deals with fund-level clawback provisions. That needs a "fund" entity spanning multiple deals, which does not exist in InvestScape's current data model. A Dev Studio project raising capital from multiple LPs maps directly onto deal-by-deal (American) waterfall math without new architecture — that's the actual use case this was built for, and the reason European waterfalls are out of scope for v1 rather than a missing feature.

---

## Verification checklist for a future editor

- [ ] Re-check `DEFAULT_PREFERRED_RETURN_RATE` and `DEFAULT_WATERFALL_TIERS` against current market practice periodically — these are industry norms, not law, and drift over time.
- [ ] Any change to `calculateGrossedUpCatchUpTarget` in `E72-gp-catchup.ts` must keep the golden test (`$80 preferred, 20% -> $20`) and its explicit negative assertion (`!== $16`) passing. If the formula itself needs to change, re-derive it from the ratio identity in this document, not from intuition.
- [ ] If per-period intra-tier sub-splitting is ever implemented (the "Phase 2" fix to the simplification described above), update this document's "How tier selection actually works" section — don't leave it describing behavior that no longer matches the code.
