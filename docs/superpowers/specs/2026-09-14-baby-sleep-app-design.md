# Baby Sleep Planner — Design Spec

**Date:** 2026-09-14
**Status:** Draft, pending review
**Working name:** Rested (changeable)

## 1. Purpose

A phone app that answers the question a parent actually asks all day: *when should he sleep next, for how long, and why?*

The user logs when the baby wakes and when he sleeps. The app returns the next suggested sleep window, a target duration, and a plain-language reason grounded in cited evidence. It ages with the child.

Primary user is one parent, on one Android phone. Secondary goal is that a second phone can be added later without rebuilding the data layer.

## 2. Scope

### In

- Onboarding: child's name, date of birth, and prematurity correction
- Logging naps and night sleep, live or after the fact
- Optional per-sleep note and one-tap mood rating
- Optional night-waking logs
- Optional motor-milestone logging (see §3.5)
- Next-sleep suggestion: window, target duration, cited reason
- Bedtime suggestion and predicted morning wake time
- Bedtime-routine consistency tracking
- History with a day-by-day visual
- Trends, normative comparison, and a confirmable personalization proposal
- Age-keyed "what to expect in the coming weeks"
- Pediatrician-referral prompts on defined red flags

### Out (deliberately)

- Feeds, diapers, growth tracking
- Night-weaning guidance — a nutrition and growth question that belongs with a pediatrician
- Accounts, login, cloud sync (v1)
- Push notifications — see §4
- Any prescribed sleep-training method or cry-interval timer
- Multiple children — the data model permits it, the UI does not build it
- **Any claim of safety benefit or SIDS-risk reduction** — see §10

## 3. Product decisions that shape everything else

### 3.1 Suggest a window, not a minute

The app never says "put him down at 1:47." It says "between 1:35 and 2:05." A single-minute target is false precision, and it sets the user up to feel like she missed. Given that mainstream sources disagree by ±45 minutes at this age (§Appendix A.3), a window is the only honest output shape.

### 3.2 Every reason carries an evidence tier

This is the core integrity feature and the main thing separating this app from its commercial equivalents.

| Tier | Meaning |
|---|---|
| **A1** | Formal consensus guideline (AASM / AAP / NSF), expert panel with systematic review |
| **A2** | Peer-reviewed meta-analysis or large normative cohort |
| **B** | Peer-reviewed primary study — small N, observational, or correlational only |
| **C** | Clinical-practice convention. Widely repeated by practitioners, **not derived from published evidence** |
| **D** | Commercial or blog assertion with no traceable source — **never shown as a reason** |

Tier D content is barred from the app entirely. Tiers A1 through C may appear, visually distinguished, so the user can tell at a glance which suggestions rest on evidence and which are useful rules of thumb.

### 3.3 Wake windows are labeled as convention, because that is what they are

The research is unambiguous. Wake windows are **Tier C**. The Director of the Yale Pediatric Sleep Center states that a PubMed search on the term returns zero references and that the specific numbers "do not seem to be based on any scientific evidence." No AAP, AASM, or NSF publication uses the term. Practitioner charts disagree by roughly ±45 minutes at 8 months.

The underlying physiology — homeostatic sleep pressure accumulating during wake (Tier A2) — is real. The specific intervals are not. In-app copy:

> Wake windows are a widely used guideline from pediatric sleep practice. They are not a medical standard, and the specific time ranges have not been tested in research. Your baby's cues matter more.

Marketing this as science would be a lie, and it is the specific lie the commercial apps in this space tell.

### 3.4 The engine is anchored on observed nap times, not wake windows

Because wake windows are Tier C, the engine's **primary** signal is the nap-clock-time distribution from Mindell 2016 — 156,989 logged sleep sessions, which found naps at 8–12 months cluster around **09:30 and 14:00** (Tier B, observed at scale). Wake-window arithmetic is a **secondary** signal that adjusts the anchor for the child's actual wake time.

This inverts how commercial apps work, and it is better grounded: observed behavior at scale beats an unsourced chart.

### 3.5 Milestones, not "regressions"

There is no evidence for a discrete 8–9 month sleep regression. Population night-waking data declines **monotonically** across the first year (−0.04 wakes/month from 7→12 months) with no bump at this age. The label is Tier D.

What *is* documented (Tier B) is that infants who recently achieved crawling or pulling-to-stand wake more than age-matched infants who have not. So the app lets the user log a milestone when it happens, and explains fragmentation in terms of **what he just learned**, not how old he is. This is both more accurate and more useful.

The app never ties logic to crawling age — the CDC removed crawling from its milestone list precisely because no age exists by which 75% of children achieve it (onset spans 5.2–13.5 months; ~5% never crawl).

### 3.6 Learning is proposed, never silent

After enough data, if the child consistently deviates from the norm, the app surfaces a proposal: *"Over the last two weeks his easy naps followed about 3h20m awake, not the typical 3h. Use 3h20m?"* The user accepts or rejects. Nothing adapts behind her back; any active adjustment is visible and reversible.

Given the width of normal variation — total sleep at 9 months spans **10.5 to 17.4 hours** across the 2nd–98th percentile — personalization is arguably more trustworthy than the population norm once there is real data. But only if it shows its work.

### 3.7 Wake events are derived, not logged

The end of a sleep *is* the start of a wake window. There is no separate "wake up" event to log or keep consistent. This removes a whole category of contradictory-data bugs.

## 4. Architecture

**Approach: no-build Progressive Web App.**

Plain HTML, CSS, and JavaScript using native ES modules. No bundler, no npm, no build step. Hosted free on GitHub Pages. Installed once to the home screen, after which it launches like a native app.

### Why this over a framework

- **Offline is a hard requirement.** A night-waking log at 2am cannot depend on the network. A service worker caches the app shell; IndexedDB holds the data.
- **Zero maintenance decay.** No dependencies means nothing to update and nothing that breaks in eighteen months.
- **Readable.** Any file can be opened and understood without knowing a framework.
- **$0 permanently**, with no free tier that can be withdrawn.

Cost: hand-written DOM updates instead of framework reactivity. At six screens this is comfortable.

### Why not notifications

Reliable scheduled local notifications are not achievable in a PWA — the browser APIs were never broadly shipped. The alternatives were an unreliable best-effort alert or a server-backed push system that would put the child's data online. Both rejected. The home screen shows a **live countdown** instead: accurate whenever the app is open, zero infrastructure.

### Module layout

| Module | Responsibility |
|---|---|
| `store.js` | IndexedDB reads/writes. The only module touching persistence. |
| `model.js` | Event-log types, ID generation, soft deletes |
| `age.js` | DOB + prematurity → corrected age in days → age band |
| `sleep-data.js` | Age-band reference table (Appendix A). Data only, no logic. |
| `engine.js` | Pure suggestion function. No DOM, no storage, no clock access. |
| `learning.js` | History analysis, adjustment proposals |
| `flags.js` | Red-flag detection and referral copy (§10.3) |
| `content.js` | Milestone and "what to expect" copy, each item tier-tagged |
| `views/*.js` | One module per screen |
| `app.js` | Routing, state wiring, app shell |
| `sw.js` | Service worker, offline caching |

`engine.js` is a **pure function** — everything it needs arrives as arguments, including the current time. The app's most important logic is testable without a browser, a database, or a real clock.

## 5. Data model

Append-only event log with soft deletes and `updatedAt` stamps. Costs nothing today; makes a future two-phone merge a last-write-wins reconciliation rather than a schema rewrite.

```js
Child   { id, name, dob, gestationalWeeksAtBirth | null, createdAt }

Sleep   { id, type: 'nap' | 'night',
          startedAt, endedAt | null,
          note?, mood?: 'easy' | 'fussy' | 'rough',
          routineFollowed?: boolean,        // night sleeps only
          createdAt, updatedAt, deletedAt | null }

Waking  { id, sleepId, wokeAt, backAsleepAt | null,
          note?, createdAt, updatedAt, deletedAt | null }

Milestone { id, kind: 'sitting' | 'crawling' | 'pullingToStand'
                | 'cruising' | 'walking' | 'other',
            observedAt, note?, createdAt, updatedAt, deletedAt | null }

Adjustment { id, kind: 'wakeWindow' | 'napAnchor', offsetMinutes,
             ageBandAtCreation, acceptedAt, active }
```

`endedAt: null` means a sleep is in progress — the single piece of state the home screen keys off.

## 6. Suggestion engine

```
suggest(now, child, sleeps, milestones, adjustments) → {
  kind: 'nap' | 'bedtime',
  windowStart, windowEnd,
  targetDuration: { min, max },
  predictedWake,
  reasons: [ { text, tier, sourceUrl } ],
  confidence: 'normal' | 'low'
}
```

### Signals, in priority order

1. **Nap clock-time anchor (Tier B, primary).** The age band's observed nap-time cluster, shifted by the difference between today's actual wake time and the band's typical wake time.
2. **Wake-window arithmetic (Tier C, secondary).** Time since last sleep ended, against the band's convention range plus any accepted adjustment. Widens or narrows the window around the anchor; never overrides it entirely.
3. **Day sleep budget (Tier A2).** Cumulative daytime sleep against the band's daytime total. Drives nap-length targets and catches an over- or under-slept day.
4. **Last night's total (Tier A2).** Including logged wakings. A short night argues for more day sleep and an earlier bedtime.
5. **Naps taken today (Tier A2).** Against expected count for the band — determines whether the next sleep is a nap or bedtime.

### Bedtime

Derived from two signals, with the app showing which is driving:

- Last nap end plus the band's wake-window convention (Tier C)
- Working backward from the total-sleep budget and a target morning wake time (Tier A2)

When the day's naps went badly, both push bedtime earlier — the correct and usually counter-intuitive answer.

**The strongest claim the app can make about bedtime is not a computed time.** It is that morning wake time is effectively fixed and bedtime is the lever (Tier A2, Iglowstein 2003: generational decline in child sleep was entirely attributable to later bedtimes, not earlier waking), and that a consistent bedtime routine on ≥5 nights/week improves sleep onset latency, night wakings, and night sleep duration (**Tier A2, RCT**, Mindell 2009/2015).

That RCT-backed finding is the single most valuable thing the app can tell this user, so routine consistency is a tracked, first-class feature — not buried in a tips screen.

### Nap length

- **Under 18 months: never suggest capping a nap.** Napping is required to reach the 12–16 h total (Tier A2, Thorpe 2015). The widespread practitioner rule of capping at 2 hours is Tier C and arguably contradicted for this age group.
- **18–24 months: a soft cap on nap *end time*, not duration.** Nap end time correlates more strongly with delayed sleep onset (r = 0.52) than nap duration does (r = 0.37) (Tier B, Nakagawa 2016). Presented as an observation, not an instruction.

### Language the app will not use

- ❌ "He's overtired" — the cortisol-surge explanation has no infant evidence, and baseline cortisol *falls* across the day, so the popular model has the trajectory backwards (Tier D).
- ✅ "A nap that ends late can push bedtime later and shorten the night." (Tier B, supported)
- ❌ "Your baby is in a sleep regression."
- ✅ "Babies often wake more in the weeks after learning something new like pulling to stand." (Tier B, supported)
- ❌ Any framing of a short nap as a problem. Infant sleep cycles run ~50 minutes (Tier A1), so a ~40–50 minute nap is one complete cycle. No evidence shows short naps are harmful.

### Guardrails

- Personal adjustments capped at ±45 minutes
- Adjustments re-evaluated at age-band crossings
- With sparse history the engine falls back to age norms and returns `confidence: 'low'`, which the UI shows
- Nap transitions are never declared on less than 2–3 weeks of consistent signal — there are no peer-reviewed criteria for declaring one (Tier C), so the app is deliberately conservative
- All date arithmetic is local-timezone aware; midnight-spanning night sleeps and DST are explicit test cases

## 7. Age-band reference data

`sleep-data.js` holds the table in Appendix A. Two rules govern it:

1. **Nothing enters without a citation and a tier.**
2. **Where sources disagree, the table carries the spread**, not an average. AASM and NSF differ on the infant upper bound (16 vs 15 h); averaging them would manufacture a number nobody published.

A third constraint the research surfaced: **AASM publishes one band for the entire 4–12 month range.** Any month-by-month total-sleep figure is interpolation, and the table marks it as such. The UI does not present interpolated values with the same confidence as guideline values.

## 8. Screens

| Screen | Contents |
|---|---|
| **Onboarding** | Name, date of birth, "was he born early?" (§10.4), safe-sleep summary, not-medical-advice acknowledgment |
| **Today** (home) | Current state; live countdown; suggestion card with window, duration, tier-tagged reasons; one large context-dependent primary button (*Start nap* / *End nap* / *Down for the night* / *He's awake*); today's sleeps |
| **Edit sleep** | Adjust times, note, mood, routine-followed toggle, delete |
| **History** | Day-by-day list, each day a 24-hour bar showing sleep against wake. Milestones marked on the timeline so disruption lines up visibly with what he just learned. |
| **Insights** | Rolling averages against age norms *with their normal ranges*; routine-consistency streak; pending personalization proposals; "what to expect" for the current age and next two months |
| **Settings** | Child details, active adjustments, safe-sleep reference, data export (JSON), reset |

Design constraints: one-handed use, large touch targets, legible at 3am in a dark room, primary action reachable by thumb without scrolling.

**Tone constraint:** the app never tells the user she did something wrong. Normative comparisons always show the range, not just the mean — because the range is enormous and that fact is itself reassuring.

## 9. Testing

The pure-function design makes the important logic directly testable.

- **Engine**: fixture days in, asserted suggestions out. Covers each age band, a short-night day, an over-napped day, a missed nap, a no-history day, and a day with a recent milestone logged.
- **Age bands**: boundary transitions including a birthday crossing mid-day; corrected-age arithmetic for a preterm infant.
- **Dates**: night sleeps spanning midnight, DST both directions, sleeps logged out of order.
- **Learning**: proposal generated on consistent deviation, *not* generated on noisy data, cap holds.
- **Flags**: each red-flag condition in §10.3 triggers, and does not false-positive on normal variation.
- **Store**: round-trip persistence, soft delete, deleted records excluded from engine input.

Manual verification on a real Android phone before handover: install to home screen, enable airplane mode, complete a full log-and-suggest cycle with no network.

## 10. Safety and boundaries

### 10.1 Claims the app will never make

AAP's 2022 safe-sleep policy, Recommendation #12, directs caregivers to be "particularly wary of devices that claim to reduce the risk of SIDS," noting such products "may provide a false sense of security and complacency." Recommendation #17 places an explicit obligation on media and manufacturers to follow safe-sleep guidelines in their messaging.

Accordingly the app makes **no claim of safety benefit, SIDS-risk reduction, or safer sleep**, in any copy, anywhere.

### 10.2 Safe-sleep content surfaced

Summarized from AAP 2022 (Moon RY et al., *Pediatrics* 150(1):e2022057990) at onboarding and available from settings:

- Supine for every sleep until 12 months; side sleeping is not safe
- Firm, flat, non-inclined surface; inclines >10° are unsafe
- Sitting devices (car seats, strollers, swings, carriers) are not recommended for routine sleep
- Room-share without bed-sharing, ideally at least the first 6 months — reduces SIDS risk by up to 50%
- No soft objects, loose bedding, bumpers, or weighted sleepers/swaddles
- Pacifier at nap and bedtime is protective
- Stop swaddling at the first sign of rolling attempts (usually 3–4 months)

The app never renders a car-seat or stroller nap as a *planned* nap.

### 10.3 Red flags that route to a pediatrician

These short-circuit the suggestion engine rather than being "solved" by it:

- Snoring, mouth breathing, or witnessed breathing pauses
- Total sleep persistently outside the 2nd–98th percentile band (at 9 months: <10.5 h or >17.4 h)
- Poor weight gain or excessive daytime sleepiness
- Sleep disruption persisting many weeks and worsening
- Signs of parental exhaustion or low mood — surfaced gently, with perinatal mental health resources

### 10.4 Prematurity

The normative data corrects for prematurity; a naive date-of-birth calculation would be wrong for a preterm infant. Onboarding asks whether the baby was born early and, if so, uses **corrected age** throughout. This is a one-question addition that prevents systematically wrong advice.

### 10.5 Disclaimer content that matters

1. Not medical advice; does not replace a pediatrician
2. Suggestions derive from population averages; individual variation at 6–9 months spans roughly **10.5 to 17.4 hours** of total sleep
3. Wake windows are practice convention, not a validated clinical standard
4. The baby's cues override the app
5. Not applicable to infants with medical conditions affecting sleep or feeding

**Recommend reviewing the compiled table and the safe-sleep copy with your pediatrician before relying on this day to day.** If this is ever shared beyond your family, the AAP Rec #12 boundary becomes a regulatory question as well as a clinical one, and would warrant a second look.

## 11. Delivery phases

| Phase | Contents |
|---|---|
| 1 | Onboarding incl. prematurity and safe-sleep, Today screen, nap/night logging, clock-anchored suggestions, offline install |
| 2 | Night wakings, notes, mood, History screen with milestone markers |
| 3 | Insights, normative comparison, routine-consistency tracking, "what to expect" content |
| 4 | Personalization proposals, red-flag detection |
| Deferred | Second-phone sync — the event-log model already permits it |

Each phase is independently usable. Phase 1 alone answers the original question.

---

# Appendix A — Compiled age-band data

Compiled 2026-09-14 from AAP, AASM, NSF, and peer-reviewed literature. Every value carries a tier and source.

## A.1 Guideline totals (Tier A1)

| Age band | AASM 2016 (24h incl. naps) | NSF 2015 (24h) |
|---|---|---|
| 4–11 mo | **12–16 h** | **12–15 h** |
| 12–24 mo | **11–14 h** | **11–14 h** |

Sources disagree on the infant upper bound. The table carries both; the app shows 12–16 h and notes NSF's narrower band rather than averaging.

- AASM: Paruthi S et al. *J Clin Sleep Med.* 2016;12(6):785–786. doi:10.5664/jcsm.5866 — https://jcsm.aasm.org/doi/10.5664/jcsm.5866 — 13-member panel, modified RAND method, 864 articles. **Endorsed by the AAP**, which reproduces it rather than publishing its own.
- NSF: Hirshkowitz M et al. *Sleep Health.* 2015;1(1):40–43 — https://www.thensf.org/sleep-duration-recommendations/

AASM explicitly excluded infants under 4 months due to wide normal variation, and cautions that "regularly sleeping more than the recommended hours may be associated with adverse health outcomes."

## A.2 Normative cohort data with day/night split (Tier A2)

**Iglowstein 2003** — Zurich Longitudinal Studies, n=493. **These are time-in-bed, not measured sleep.** The paper's own PSG comparison at 9 months found 10.2 h actual sleep vs 11.2 h time-in-bed — **a ~1 hour gap**. The app measures the time-in-bed quantity and labels it accordingly.

| Age | Total mean (SD) | Total 2nd–98th | Night mean (SD) | Day mean (SD) | Day 2nd–98th |
|---|---|---|---|---|---|
| 6 mo | 14.2 (1.9) | 10.4–18.1 | 11.0 (1.1) | 3.4 (1.5) | 0.4–6.4 |
| 9 mo | 13.9 (1.7) | 10.5–17.4 | 11.2 (1.0) | 2.8 (1.2) | 0.2–5.3 |
| 12 mo | 13.9 (1.2) | 11.4–16.5 | 11.7 (1.0) | 2.4 (1.1) | 0.2–4.6 |
| 18 mo | 13.6 (1.2) | 11.1–16.0 | 11.6 (0.9) | 2.0 (0.7) | 0.5–3.6 |
| 24 mo | 13.2 (1.2) | 10.8–15.6 | 11.5 (0.9) | 1.8 (0.5) | 0.7–2.9 |

Hours. Source: *Pediatrics.* 2003;111(2):302–307. doi:10.1542/peds.111.2.302 — https://publications.aap.org/pediatrics/article/111/2/302/66745/

**The 7.7-hour spread at 6 months is the most important number in this appendix.** It calibrates how confidently the app is permitted to speak.

**Galland 2012** — meta-analysis, 34 studies, 18 countries. Code-ready regression (R²=0.89), age in years, result in hours:

```
TST_hours = 10.49 − 5.56 × ( (age_years / 10)^0.5 − 0.71 )
```

Checks: 8 mo → 13.0 h; 2 y → 11.95 h. Source: *Sleep Med Rev.* 2012;16(3):213–222. doi:10.1016/j.smrv.2011.06.001

| Variable | Age | Mean | Range (±1.96 SD) |
|---|---|---|---|
| Night wakings | 7–11 mo | **1.1** | 0–3.1 |
| Naps/day | 6–11 mo | **2.2** | 0.9–3.5 |
| Naps/day | 12–24 mo | 1.2 | 0.4–2.1 |
| Sleep latency | 0–2 y | 19 min | 0–43 |

## A.3 Nap clock-time anchors (Tier B — the engine's primary signal)

Mindell 2016, 841 children, 156,989 logged sleep sessions:

| Age | Pattern |
|---|---|
| 3–7 mo | Two naps ~1.5 h each; night sleep ~10.5 h |
| **8–12 mo** | **Bimodal — naps cluster ~09:30 and ~14:00** |
| 13–34 mo | Converging to one midday nap, midpoint ~14:00 |

Morning wake times are consistent across 5–36 months. Later bedtime is associated with shorter night sleep.

Source: Mindell JA et al. *J Sleep Res.* 2016;25(5):508–516 — https://pubmed.ncbi.nlm.nih.gov/27252030/

## A.4 Wake-window convention, with its disagreement shown (Tier C)

| Age | Taking Cara Babies | Huckleberry | Baby Sleep Site (per-window) |
|---|---|---|---|
| 5–7 mo | 2–3 h | 2–3 h @6mo | — |
| **7–10 mo** | **2.5–3.5 h** | **2.25–3.5 h @7mo** | **WW1 2–2.5 h; WW2 2–3 h; last 2–4 h** |
| 11–14 mo | 3–4 h | 3.25–4 h @12mo | — |

**Spread at 8 months: 2.0–3.5 h.** Two conventions all sources agree on, consistent with the two-process model: the **first** wake window of the day is shortest, the **last** is longest.

Huckleberry's "SweetSpot" has **no peer-reviewed validation study**. It is an unvalidated commercial product, not a standard.

## A.5 Nap transitions

| Transition | Evidence | Tier |
|---|---|---|
| 4 → 3 naps | **No published age estimate exists.** Convention: 4–6 mo | C |
| 3 → 2 naps | Weissbluth 1995: two naps "well established by 9–12 months." Convention: 8–9 mo | C, partial A2 |
| **2 → 1 nap** | Iglowstein: **18 mo**. Staton meta-analysis: **12–18 mo**. US convention: ~15 mo | **A2** |

Sources conflict on 2→1. The app shows the **12–18 month range**, not a point estimate — a 14-month-old on two naps is normal by every peer-reviewed source. Under 24 months the app never suggests dropping the nap entirely (<2.5% of children cease napping before age 2).

Transition *signals* have no peer-reviewed criteria (Tier C): consistent refusal of the last nap, that nap shortening or fragmenting, bedtime pushed unacceptably late, new early waking — **sustained ≥2–3 weeks**.

Source: Staton S et al. *Sleep Med Rev.* 2020;50:101247. Note: 47.7% of its 44 included studies were rated high risk of bias. Use without false precision.

## A.6 App data table

| Band | Total 24h | Night (time-in-bed) | Day total | Naps | Interpolated? |
|---|---|---|---|---|---|
| 4–5 mo | 12–16 h | 9.5–11.5 h | 3–4.5 h | 3–4 | day/night yes |
| 6–7 mo | 12–16 h | 10–11.5 h | 2.5–4 h | 2–3 | partly |
| **8–9 mo** | **12–16 h** | **10–11.5 h** | **2.25–3.5 h** | **2** | partly |
| 10–11 mo | 12–16 h | 10.5–12 h | 2–3 h | 2 | yes |
| 12–14 mo | 11–14 h | 10.5–12 h | 2–3 h | 1–2 | partly |
| 15–17 mo | 11–14 h | 10.5–12 h | 1.75–2.75 h | 1–2 | yes |
| 18–24 mo | 11–14 h | 10.5–12 h | 1.25–2.5 h | 1 | partly |

Totals are Tier A1 (AASM). Day/night splits are Tier A2 (Iglowstein), time-in-bed equivalent. Rows marked interpolated are not guideline values and the UI reflects that.

## A.7 The 8-month-old — normative profile

| Variable | Value | Tier |
|---|---|---|
| Total sleep | 12–16 h guideline; 10.5–17.4 h observed 2nd–98th | A1 / A2 |
| Night (time-in-bed) | 11.2 h (SD 1.0) ≈ **~10.2 h actual** | A2 |
| Day sleep | 2.8 h (SD 1.2; 0.2–5.3) | A2 |
| Naps | 2.2 mean (0.9–3.5) | A2 |
| Nap times | **~09:30 and ~14:00** | B |
| **Night wakings** | **1.1/night (0–3.1)** | A2 |
| Still waking ≥1×/night at 6–12 mo | **78.6%** | B |
| Receiving ≥1 night feed at 6–12 mo | **61.4%** | B |

**The most useful reassurance in the app: about one night waking is the population average, up to three is within normal range, and ~8 in 10 babies this age still wake at night.**

## A.8 What to expect, 9–10 months

| Expect | Tier |
|---|---|
| Consolidation to 2 naps if not already there | C / A2 |
| Total sleep declining slowly — ~5.4 min/month across 7–12 mo | A2 |
| Night wakings continuing ~1/night, declining only 0.04/month | A2 |
| **Pulling to stand and cruising**, with temporary sleep fragmentation | A1 milestone / B sleep link |
| **Separation anxiety intensifying** toward its 10–18 month peak (onset ~8 mo, resolves by ~24 mo) | A1 |
| Night sleep lengthening toward 11.7 h at 12 mo while day sleep falls | A2 |
| **Not** a discrete universal "regression" — population waking declines monotonically | A2 |

Separation anxiety source: Merck Manual Professional; CHOP. Milestones: CDC *Learn the Signs, Act Early*, 9-month list — https://www.cdc.gov/act-early/milestones/9-months.html

## A.9 Bedtime evidence

| Finding | Tier |
|---|---|
| **Morning wake time is fixed; bedtime is the lever.** Generational decline in child sleep was entirely attributable to later bedtimes | A2 |
| Later bedtime → shorter night sleep | A2 / B |
| **Consistent bedtime routine improves sleep onset latency, night wakings, WASO, and night sleep duration** — RCT, n=405 | **A2 (RCT)** |
| Dose-dependent: **≥5 nights/week** is the threshold | A2 |
| Observed bedtimes, Zurich: 6 mo → 20:16 (SD 1:08), wake 07:13; 12 mo → 19:46, wake 07:19 | A2 |
| International spread: 19:27 (NZ) to 22:17 (Hong Kong); 101-minute spread in total sleep | A2 |

US practitioner sources recommend meaningfully earlier bedtimes than international observational data show. The app says so rather than presenting 19:00 as "the" bedtime.

## A.10 Overtiredness — what is real

The popular cortisol-surge model is **Tier D in infants** and has the hormone trajectory backwards: baseline diurnal cortisol *falls* across the day, reaching its lowest around bedtime, while sleep pressure rises.

What is real:

| Mechanism | Tier |
|---|---|
| Homeostatic sleep pressure (Process S) accumulating during wake, interacting with circadian Process C | A2 |
| Sleep pressure accumulates more slowly with age — the mechanism by which naps consolidate and drop out | A2 |
| **Wake maintenance zone** — circadian alerting in the ~2 h before melatonin onset actively opposes sleep despite high pressure. The real "second wind." | A2 in adults; **not characterized in infants** |
| Late-ending naps → later sleep onset (r=0.52) and shorter night | B |
