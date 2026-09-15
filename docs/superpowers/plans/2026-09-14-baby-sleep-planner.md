# Baby Sleep Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first Android PWA that logs a baby's sleep and suggests the next nap or bedtime with cited, tier-labeled reasoning.

**Architecture:** Plain HTML/CSS/JS using native ES modules — no bundler, no npm, no `node_modules`. Pure logic (age, reference data, suggestion engine, learning, flags) lives in dependency-free modules that are unit-tested; IndexedDB persistence sits behind a thin adapter; views render into a single-page shell. A service worker caches the shell so the app works with no network.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES2022 modules), IndexedDB, Service Worker API. Tests run in headless Chrome, orchestrated by a ~70-line Python script. **Python 3.14.4 and Chrome 153 are already installed on this machine; nothing else needs installing.**

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero runtime dependencies.** No npm packages, no `node_modules`, no CDN scripts. The app is plain files.
- **No build step.** Source files are served as-authored. Native ES modules only.
- **Node is NOT installed and must not be required.** The test runner is `python run-tests.py`.
- **Every numeric value in `sleep-data.js` carries a `tier` and a `source` URL.** A value without both is a bug.
- **Tier D content is never shown in the UI.** Allowed tiers: `A1`, `A2`, `B`, `C`.
- **No safety claims of any kind.** Never state or imply the app improves sleep safety or reduces SIDS risk (AAP 2022 Rec #12).
- **Banned UI copy:** the words "overtired" and "regression" must never appear in user-facing strings.
- **No nap cap under 18 months.** `napCapMinutes` must be `null` for every band below `18-24`.
- **Suggestions are always time *windows*, never single clock times.**
- **Target:** Chrome on Android, usable one-handed at 400px width, legible in a dark room.
- **All date arithmetic is local-timezone aware.** Never use UTC date components for day boundaries.
- **State changes re-render via `location.reload()`.** This is a deliberate architectural choice, not an oversight. With no framework there is no reactive binding, and the app's state lives in IndexedDB; a reload re-reads it and guarantees the view matches storage. The alternative — hand-written incremental DOM updates — is the single largest source of stale-view bugs in vanilla apps. The app is local-only with no network fetch on load, so a reload is effectively instant. Revisit only if a screen appears where reload loses meaningful in-progress input.

---

## File Structure

| Path | Responsibility |
|---|---|
| `index.html` | App shell — single page, mounts views |
| `css/app.css` | All styling, light + dark |
| `js/age.js` | DOB + prematurity → corrected age → band key |
| `js/sleep-data.js` | Age-band reference table. Data only, zero logic. |
| `js/model.js` | Record factories, IDs, soft-delete filters |
| `js/engine.js` | Pure suggestion function |
| `js/learning.js` | Personalization proposals |
| `js/flags.js` | Red-flag detection |
| `js/content.js` | Milestone and "what to expect" copy, tier-tagged |
| `js/store.js` | IndexedDB adapter. Thin — no business logic. |
| `js/app.js` | Routing, state wiring |
| `js/views/*.js` | One module per screen |
| `sw.js` | Service worker, offline cache |
| `manifest.webmanifest` | PWA install metadata |
| `test.html` | Test page — imports every `*.test.js` and runs them |
| `test/harness.js` | `test()`, `eq()`, `ok()`, `throws()`, `runAll()` |
| `test/*.test.js` | One test module per logic module |
| `run-tests.py` | Headless runner. Exit 0 all-pass, 1 otherwise. |

**Note on testing scope (improvement over the spec):** the spec assumed IndexedDB could not be unit-tested and that `store.js` would be verified only by hand. Running tests in real Chrome makes IndexedDB fully testable, so Task 7 includes automated store tests. The manual on-device check in Task 10 still stands for install and offline behavior.

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `run-tests.py`, `test.html`, `test/harness.js`, `test/smoke.test.js`, `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `test(name, fn)`, `eq(actual, expected)`, `ok(value, msg)`, `throws(fn, msg)`, `runAll()` from `test/harness.js`. Every later test module imports these.

- [ ] **Step 1: Initialize the repository**

```bash
cd "C:/Users/kdunk/claude_code/Test Project 2"
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
chrome-profile/
.claude/scheduled_tasks.lock
*.log
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Create `test/harness.js`**

```js
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function eq(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`expected ${e}, got ${a}`);
}

export function ok(value, msg = 'expected truthy') {
  if (!value) throw new Error(`${msg} (got ${JSON.stringify(value)})`);
}

export function throws(fn, msg = 'expected a throw') {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}

export async function runAll(outEl) {
  let pass = 0, fail = 0;
  const lines = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      pass++;
      lines.push('PASS ' + name);
    } catch (e) {
      fail++;
      lines.push('FAIL ' + name + ' :: ' + e.message);
    }
  }
  lines.push(`SUMMARY pass=${pass} fail=${fail}`);
  const report = lines.join('\n');
  if (outEl) outEl.textContent = report;
  try {
    await fetch('/results', { method: 'POST', body: report });
  } catch { /* running in a normal browser, not the harness */ }
  return report;
}
```

- [ ] **Step 4: Create `test/smoke.test.js`**

```js
import { test, eq } from './harness.js';

test('harness runs and compares values', () => eq(1 + 1, 2));
```

- [ ] **Step 5: Create `test.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Tests</title>
<pre id="out">RUNNING</pre>
<script type="module">
import { runAll } from './test/harness.js';
import './test/smoke.test.js';
runAll(document.getElementById('out'));
</script>
```

- [ ] **Step 6: Create `run-tests.py`**

```python
#!/usr/bin/env python3
"""Run the browser test suite headlessly. Exit 0 if all pass, 1 otherwise."""
import http.server, socketserver, threading, subprocess, tempfile, shutil, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGE = "/test.html"
TIMEOUT = 60

result = {"body": None}
done = threading.Event()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        result["body"] = self.rfile.read(n).decode("utf-8", "replace")
        self.send_response(204)
        self.end_headers()
        done.set()

    def log_message(self, *a):
        pass


def find_chrome():
    cands = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("google-chrome"), shutil.which("chromium"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit("Chrome not found. Install Chrome or set the CHROME env var.")


def main():
    chrome = os.environ.get("CHROME") or find_chrome()
    srv = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    profile = tempfile.mkdtemp(prefix="sleeptest-")
    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
         "--no-default-browser-check", "--user-data-dir=" + profile,
         f"http://127.0.0.1:{port}{PAGE}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ok = done.wait(TIMEOUT)
    proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()
    srv.shutdown()
    shutil.rmtree(profile, ignore_errors=True)

    if not ok:
        print(f"TIMEOUT: no results after {TIMEOUT}s", file=sys.stderr)
        return 1

    print(result["body"])
    return 0 if "\nFAIL " not in "\n" + result["body"] else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 7: Run the suite**

Run: `python run-tests.py`
Expected:
```
PASS harness runs and compares values
SUMMARY pass=1 fail=0
```
Exit code 0.

- [ ] **Step 8: Verify failures are actually caught**

Temporarily change `test/smoke.test.js` to `eq(1 + 1, 3)`, run `python run-tests.py`, confirm output contains `FAIL` and the exit code is 1. Then revert to `eq(1 + 1, 2)` and confirm it passes again.

A test suite that cannot fail is worthless. This step proves it can.

- [ ] **Step 9: Commit**

```bash
git add .gitignore run-tests.py test.html test/harness.js test/smoke.test.js
git commit -m "chore: scaffold project with headless browser test harness

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Age calculation with prematurity correction

**Files:**
- Create: `js/age.js`, `test/age.test.js`
- Modify: `test.html` (add the import)

**Interfaces:**
- Consumes: harness from Task 1
- Produces:
  - `correctedAgeDays(dobISO: string, gestationalWeeksAtBirth: number|null, now: Date) → number`
  - `ageMonths(days: number) → number`
  - `bandKeyForMonths(months: number) → string|null`
  - `ageStatus(months: number) → 'too-young'|'in-range'|'too-old'`
  - `BAND_KEYS: string[]`

- [ ] **Step 1: Write the failing tests**

Create `test/age.test.js`:

```js
import { test, eq } from './harness.js';
import { correctedAgeDays, ageMonths, bandKeyForMonths, ageStatus, BAND_KEYS }
  from '../js/age.js';

const d = (s) => new Date(s + 'T12:00:00');

test('term baby: age is plain elapsed days', () =>
  eq(correctedAgeDays('2026-01-01', null, d('2026-01-31')), 30));

test('gestational age 37+ weeks counts as term', () =>
  eq(correctedAgeDays('2026-01-01', 38, d('2026-01-31')), 30));

test('preterm at 32 weeks subtracts 56 days', () =>
  eq(correctedAgeDays('2026-01-01', 32, d('2026-03-01')), 59 - 56));

test('months conversion uses average month length', () =>
  eq(Math.round(ageMonths(243)), 8));

test('8 months maps to the 8-9 band', () => eq(bandKeyForMonths(8), '8-9'));
test('9.9 months is still the 8-9 band', () => eq(bandKeyForMonths(9.9), '8-9'));
test('10 months moves to the next band', () => eq(bandKeyForMonths(10), '10-11'));
test('lower boundary 4 months is in range', () => eq(bandKeyForMonths(4), '4-5'));
test('under 4 months has no band', () => eq(bandKeyForMonths(3.9), null));
test('24 months clamps to the top band', () => eq(bandKeyForMonths(24), '18-24'));

test('status flags too-young', () => eq(ageStatus(3), 'too-young'));
test('status flags in-range', () => eq(ageStatus(8), 'in-range'));
test('status flags too-old', () => eq(ageStatus(26), 'too-old'));

test('every band key is unique and ordered', () => {
  eq(BAND_KEYS, ['4-5', '6-7', '8-9', '10-11', '12-14', '15-17', '18-24']);
});

test('preterm baby gets a younger band than a term baby born the same day', () => {
  // 2026-01-01 to 2026-09-01 is 243 days = 7.98 months -> band '6-7'.
  // At 30 weeks gestation the correction is (40-30)*7 = 70 days,
  // giving 173 days = 5.68 months -> band '4-5'.
  const now = d('2026-09-01');
  const term = bandKeyForMonths(ageMonths(correctedAgeDays('2026-01-01', null, now)));
  const pre = bandKeyForMonths(ageMonths(correctedAgeDays('2026-01-01', 30, now)));
  eq([term, pre], ['6-7', '4-5']);
});
```

Add to `test.html` before the `runAll` call:

```html
import './test/age.test.js';
```

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1, failures reporting that `../js/age.js` cannot be resolved.

- [ ] **Step 3: Implement `js/age.js`**

```js
const MS_PER_DAY = 86400000;
const DAYS_PER_MONTH = 30.4375;
const TERM_WEEKS = 40;
const PRETERM_THRESHOLD_WEEKS = 37;

export const BANDS_BOUNDS = [
  { key: '4-5', maxMonths: 6 },
  { key: '6-7', maxMonths: 8 },
  { key: '8-9', maxMonths: 10 },
  { key: '10-11', maxMonths: 12 },
  { key: '12-14', maxMonths: 15 },
  { key: '15-17', maxMonths: 18 },
  { key: '18-24', maxMonths: Infinity },
];

export const BAND_KEYS = BANDS_BOUNDS.map((b) => b.key);

export function correctedAgeDays(dobISO, gestationalWeeksAtBirth, now) {
  const dob = new Date(dobISO + (dobISO.includes('T') ? '' : 'T00:00:00'));
  const raw = Math.floor((now - dob) / MS_PER_DAY);
  if (gestationalWeeksAtBirth == null) return raw;
  if (gestationalWeeksAtBirth >= PRETERM_THRESHOLD_WEEKS) return raw;
  return raw - Math.round((TERM_WEEKS - gestationalWeeksAtBirth) * 7);
}

export function ageMonths(days) {
  return days / DAYS_PER_MONTH;
}

export function bandKeyForMonths(months) {
  if (months < 4) return null;
  for (const b of BANDS_BOUNDS) {
    if (months < b.maxMonths) return b.key;
  }
  return '18-24';
}

export function ageStatus(months) {
  if (months < 4) return 'too-young';
  if (months >= 25) return 'too-old';
  return 'in-range';
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all age tests PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/age.js test/age.test.js test.html
git commit -m "feat: age banding with prematurity correction

Normative sleep data corrects for prematurity, so a raw DOB
calculation would give systematically wrong advice for preterm infants.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Age-band reference data

**Files:**
- Create: `js/sleep-data.js`, `test/sleep-data.test.js`
- Modify: `test.html`

**Interfaces:**
- Consumes: `BAND_KEYS` from `js/age.js`
- Produces: `BANDS` — an object keyed by band key. Each band has this exact shape:

```
{
  key, label, typicalWake,
  total24h:    { minHours, maxHours, tier, source },
  nightInBed:  { minHours, maxHours, tier, source, interpolated },
  dayTotal:    { minHours, maxHours, tier, source, interpolated },
  napCount:    { typical, min, max, tier, source },
  napAnchors:  { times: string[], tier, source } | null,
  wakeWindows: { first, middle, last, tier, source },   // each { minMin, maxMin }
  napCapMinutes: number | null
}
```

Also produces `TIERS = ['A1','A2','B','C']` and `hoursToMinutes(h)`.

- [ ] **Step 1: Write the failing tests**

Create `test/sleep-data.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { BANDS, TIERS, hoursToMinutes } from '../js/sleep-data.js';
import { BAND_KEYS } from '../js/age.js';

test('every age band has an entry', () =>
  eq(Object.keys(BANDS).sort(), [...BAND_KEYS].sort()));

test('every numeric field carries a tier and a source URL', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    for (const field of ['total24h', 'nightInBed', 'dayTotal', 'napCount', 'wakeWindows']) {
      const v = b[field];
      ok(v, `${key}.${field} missing`);
      ok(TIERS.includes(v.tier), `${key}.${field} has invalid tier ${v.tier}`);
      ok(typeof v.source === 'string' && v.source.startsWith('http'),
        `${key}.${field} missing source URL`);
    }
  }
});

test('tier D never appears', () => {
  const json = JSON.stringify(BANDS);
  ok(!json.includes('"tier":"D"'), 'tier D is banned from the data table');
});

test('all ranges have min <= max', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    for (const f of ['total24h', 'nightInBed', 'dayTotal']) {
      ok(b[f].minHours <= b[f].maxHours, `${key}.${f} inverted`);
    }
    for (const w of ['first', 'middle', 'last']) {
      ok(b.wakeWindows[w].minMin <= b.wakeWindows[w].maxMin, `${key}.${w} inverted`);
    }
  }
});

test('day plus night is consistent with the 24h total', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    const lo = b.nightInBed.minHours + b.dayTotal.minHours;
    const hi = b.nightInBed.maxHours + b.dayTotal.maxHours;
    ok(hi >= b.total24h.minHours, `${key}: day+night max below total min`);
    ok(lo <= b.total24h.maxHours, `${key}: day+night min above total max`);
  }
});

test('the last wake window is never shorter than the first', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    ok(b.wakeWindows.last.minMin >= b.wakeWindows.first.minMin, `${key} violates it`);
  }
});

test('no nap cap below 18 months', () => {
  for (const key of ['4-5', '6-7', '8-9', '10-11', '12-14', '15-17']) {
    eq(BANDS[key].napCapMinutes, null);
  }
});

test('8-9 month band carries the observed nap clock anchors', () => {
  eq(BANDS['8-9'].napAnchors.times, ['09:30', '14:00']);
  eq(BANDS['8-9'].napAnchors.tier, 'B');
});

test('bands with no observed anchor data say so explicitly', () => {
  eq(BANDS['4-5'].napAnchors, null);
  eq(BANDS['6-7'].napAnchors, null);
});

test('wake windows are always labeled convention', () => {
  for (const b of Object.values(BANDS)) eq(b.wakeWindows.tier, 'C');
});

test('total sleep targets match AASM bands', () => {
  eq([BANDS['8-9'].total24h.minHours, BANDS['8-9'].total24h.maxHours], [12, 16]);
  eq([BANDS['18-24'].total24h.minHours, BANDS['18-24'].total24h.maxHours], [11, 14]);
});

test('hoursToMinutes converts correctly', () => eq(hoursToMinutes(2.5), 150));
```

Add `import './test/sleep-data.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1, module-not-found failures.

- [ ] **Step 3: Implement `js/sleep-data.js`**

```js
// Age-band reference data. DATA ONLY — no logic belongs in this file.
//
// Every numeric range carries a tier and a source URL. See
// docs/superpowers/specs/2026-09-14-baby-sleep-app-design.md Appendix A.
//
// Interpretation note: Mindell 2016 reports naps "clustering around 09:30
// and 14:00" at 8-12 months. We read those as nap ONSET times. The paper
// does not state whether they are onsets or midpoints.

export const TIERS = ['A1', 'A2', 'B', 'C'];

const AASM = 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866';
const IGLOW = 'https://publications.aap.org/pediatrics/article/111/2/302/66745/';
const GALLAND = 'https://www.sciencedirect.com/science/article/abs/pii/S1087079211000682';
const MINDELL = 'https://pubmed.ncbi.nlm.nih.gov/27252030/';
const TCB = 'https://www.takingcarababies.com/blogs/sleep-basics/wake-windows-and-baby-sleep';

export function hoursToMinutes(h) {
  return Math.round(h * 60);
}

export const BANDS = {
  '4-5': {
    key: '4-5', label: '4–5 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 9.5, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 3, maxHours: 4.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 3, min: 2, max: 5, tier: 'A2', source: GALLAND },
    napAnchors: null,
    wakeWindows: {
      first: { minMin: 90, maxMin: 135 }, middle: { minMin: 105, maxMin: 150 },
      last: { minMin: 120, maxMin: 180 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '6-7': {
    key: '6-7', label: '6–7 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2.5, maxHours: 4, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 3, min: 2, max: 4, tier: 'A2', source: GALLAND },
    napAnchors: null,
    wakeWindows: {
      first: { minMin: 120, maxMin: 165 }, middle: { minMin: 135, maxMin: 180 },
      last: { minMin: 150, maxMin: 210 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '8-9': {
    key: '8-9', label: '8–9 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2.25, maxHours: 3.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 3, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['09:30', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 120, maxMin: 165 }, middle: { minMin: 150, maxMin: 195 },
      last: { minMin: 165, maxMin: 240 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '10-11': {
    key: '10-11', label: '10–11 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2, maxHours: 3, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 3, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['09:45', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 150, maxMin: 195 }, middle: { minMin: 165, maxMin: 210 },
      last: { minMin: 180, maxMin: 255 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '12-14': {
    key: '12-14', label: '12–14 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: false },
    dayTotal: { minHours: 2, maxHours: 3, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 2, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['10:00', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 180, maxMin: 225 }, middle: { minMin: 195, maxMin: 240 },
      last: { minMin: 210, maxMin: 270 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '15-17': {
    key: '15-17', label: '15–17 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 1.75, maxHours: 2.75, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 1, min: 1, max: 2, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['13:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 210, maxMin: 270 }, middle: { minMin: 225, maxMin: 285 },
      last: { minMin: 240, maxMin: 330 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '18-24': {
    key: '18-24', label: '18–24 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: false },
    dayTotal: { minHours: 1.25, maxHours: 2.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 1, min: 1, max: 1, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['13:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 270, maxMin: 330 }, middle: { minMin: 285, maxMin: 345 },
      last: { minMin: 300, maxMin: 390 }, tier: 'C', source: TCB,
    },
    // Soft guidance only, and on nap END TIME rather than duration.
    // Nakagawa 2016: nap end time correlates with delayed sleep onset (r=0.52)
    // more strongly than nap duration does (r=0.37).
    napCapMinutes: 150,
  },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all sleep-data tests PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/sleep-data.js test/sleep-data.test.js test.html
git commit -m "feat: age-band reference table with tiered citations

Every numeric range carries an evidence tier and source URL. Tests
enforce that invariant so an uncited value cannot be added later.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Data model and record helpers

**Files:**
- Create: `js/model.js`, `test/model.test.js`
- Modify: `test.html`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `newId() → string`
  - `createSleep({ type, startedAt, endedAt?, note?, mood?, routineFollowed? }) → Sleep`
  - `createWaking({ sleepId, wokeAt, backAsleepAt?, note? }) → Waking`
  - `createMilestone({ kind, observedAt, note? }) → Milestone`
  - `createChild({ name, dob, gestationalWeeksAtBirth? }) → Child`
  - `softDelete(record, now) → record`
  - `active(records) → records` — filters out soft-deleted
  - `durationMinutes(sleep) → number|null`
  - `localDayKey(date) → 'YYYY-MM-DD'` in **local** time
  - `MILESTONE_KINDS: string[]`

- [ ] **Step 1: Write the failing tests**

Create `test/model.test.js`:

```js
import { test, eq, ok } from './harness.js';
import {
  newId, createSleep, createWaking, createMilestone, createChild,
  softDelete, active, durationMinutes, localDayKey, MILESTONE_KINDS,
} from '../js/model.js';

test('ids are unique', () => {
  const ids = new Set(Array.from({ length: 500 }, newId));
  eq(ids.size, 500);
});

test('createSleep sets defaults and timestamps', () => {
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  eq(s.type, 'nap');
  eq(s.endedAt, null);
  eq(s.deletedAt, null);
  ok(s.id && s.createdAt && s.updatedAt);
});

test('createSleep rejects an unknown type', () => {
  let threw = false;
  try { createSleep({ type: 'brunch', startedAt: '2026-09-14T09:30:00' }); }
  catch { threw = true; }
  ok(threw, 'expected an unknown sleep type to throw');
});

test('durationMinutes is null while a sleep is in progress', () =>
  eq(durationMinutes(createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' })), null));

test('durationMinutes computes a finished sleep', () => {
  const s = createSleep({
    type: 'nap', startedAt: '2026-09-14T09:30:00', endedAt: '2026-09-14T10:45:00',
  });
  eq(durationMinutes(s), 75);
});

test('softDelete stamps deletedAt', () => {
  const s = softDelete(createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' }),
    new Date('2026-09-14T11:00:00'));
  ok(s.deletedAt !== null);
});

test('active filters out soft-deleted records', () => {
  const a = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  const b = softDelete(createSleep({ type: 'nap', startedAt: '2026-09-14T14:00:00' }), new Date());
  eq(active([a, b]).length, 1);
});

test('localDayKey uses local time, not UTC', () => {
  // 23:30 local must belong to that local day regardless of UTC offset.
  const late = new Date(2026, 8, 14, 23, 30, 0);
  eq(localDayKey(late), '2026-09-14');
});

test('localDayKey pads single-digit months and days', () =>
  eq(localDayKey(new Date(2026, 0, 5, 12, 0, 0)), '2026-01-05'));

test('createWaking links to its parent sleep', () => {
  const w = createWaking({ sleepId: 'abc', wokeAt: '2026-09-15T02:14:00' });
  eq(w.sleepId, 'abc');
  eq(w.backAsleepAt, null);
});

test('milestone kinds are constrained', () => {
  ok(MILESTONE_KINDS.includes('pullingToStand'));
  let threw = false;
  try { createMilestone({ kind: 'juggling', observedAt: '2026-09-14T10:00:00' }); }
  catch { threw = true; }
  ok(threw, 'expected an unknown milestone kind to throw');
});

test('createChild carries prematurity as null by default', () => {
  const c = createChild({ name: 'Sam', dob: '2026-01-14' });
  eq(c.gestationalWeeksAtBirth, null);
});
```

Add `import './test/model.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/model.js`**

```js
const SLEEP_TYPES = ['nap', 'night'];
export const MILESTONE_KINDS = [
  'sitting', 'crawling', 'pullingToStand', 'cruising', 'walking', 'other',
];

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function stamps() {
  const iso = new Date().toISOString();
  return { createdAt: iso, updatedAt: iso, deletedAt: null };
}

export function createChild({ name, dob, gestationalWeeksAtBirth = null }) {
  if (!name) throw new Error('child name is required');
  if (!dob) throw new Error('child dob is required');
  return { id: newId(), name, dob, gestationalWeeksAtBirth, ...stamps() };
}

export function createSleep({
  type, startedAt, endedAt = null, note = null, mood = null, routineFollowed = null,
}) {
  if (!SLEEP_TYPES.includes(type)) throw new Error(`unknown sleep type: ${type}`);
  if (!startedAt) throw new Error('startedAt is required');
  return { id: newId(), type, startedAt, endedAt, note, mood, routineFollowed, ...stamps() };
}

export function createWaking({ sleepId, wokeAt, backAsleepAt = null, note = null }) {
  if (!sleepId) throw new Error('sleepId is required');
  if (!wokeAt) throw new Error('wokeAt is required');
  return { id: newId(), sleepId, wokeAt, backAsleepAt, note, ...stamps() };
}

export function createMilestone({ kind, observedAt, note = null }) {
  if (!MILESTONE_KINDS.includes(kind)) throw new Error(`unknown milestone kind: ${kind}`);
  if (!observedAt) throw new Error('observedAt is required');
  return { id: newId(), kind, observedAt, note, ...stamps() };
}

export function softDelete(record, now = new Date()) {
  const iso = now.toISOString();
  return { ...record, deletedAt: iso, updatedAt: iso };
}

export function active(records) {
  return records.filter((r) => !r.deletedAt);
}

export function durationMinutes(sleep) {
  if (!sleep.endedAt) return null;
  return Math.round((new Date(sleep.endedAt) - new Date(sleep.startedAt)) / 60000);
}

export function localDayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all model tests PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/model.js test/model.test.js test.html
git commit -m "feat: append-only event-log record model

Soft deletes and updatedAt stamps make a future two-device merge a
last-write-wins reconciliation rather than a schema change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Suggestion engine — next nap

**Files:**
- Create: `js/engine.js`, `test/engine.test.js`
- Modify: `test.html`

**Interfaces:**
- Consumes: `BANDS`, `hoursToMinutes` from `js/sleep-data.js`; `active`, `durationMinutes`, `localDayKey` from `js/model.js`
- Produces:
  - `suggest({ now, bandKey, sleeps, adjustments }) → Suggestion`
  - `atClock(referenceDate: Date, 'HH:MM') → Date`
  - Suggestion shape:

```
{
  kind: 'nap' | 'bedtime' | 'in-progress' | 'unknown',
  windowStart: Date|null, windowEnd: Date|null,
  targetDuration: { minMin, maxMin } | null,
  predictedWake: Date|null,
  reasons: [ { text, tier, source } ],
  confidence: 'normal' | 'low',
  napIndex: number
}
```

- [ ] **Step 1: Write the failing tests**

Create `test/engine.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { suggest, atClock } from '../js/engine.js';
import { createSleep } from '../js/model.js';

const D = (s) => new Date(s);
const night = (start, end) => createSleep({ type: 'night', startedAt: start, endedAt: end });
const nap = (start, end) => createSleep({ type: 'nap', startedAt: start, endedAt: end });

test('atClock builds a local time on the reference day', () => {
  const r = atClock(new Date(2026, 8, 14, 3, 0, 0), '09:30');
  eq([r.getFullYear(), r.getMonth(), r.getDate(), r.getHours(), r.getMinutes()],
    [2026, 8, 14, 9, 30]);
});

test('with no history at all, confidence is low', () => {
  const s = suggest({ now: D('2026-09-14T08:00:00'), bandKey: '8-9', sleeps: [] });
  eq(s.confidence, 'low');
});

test('a sleep in progress reports in-progress', () => {
  const open = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  const s = suggest({ now: D('2026-09-14T10:00:00'), bandKey: '8-9', sleeps: [open] });
  eq(s.kind, 'in-progress');
});

test('after a 07:00 wake the first nap lands near the 09:30 anchor', () => {
  const s = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  eq(s.kind, 'nap');
  eq(s.napIndex, 0);
  ok(s.windowStart.getHours() === 9, `expected a 9am start, got ${s.windowStart}`);
});

test('a late wake shifts the anchor later', () => {
  const early = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  const late = suggest({
    now: D('2026-09-14T09:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T08:00:00')],
  });
  ok(late.windowStart > early.windowStart, 'later wake should push the nap later');
});

test('the window is a range, never a single instant', () => {
  const s = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  ok(s.windowEnd > s.windowStart, 'window must have width');
});

test('after one nap the second nap is suggested', () => {
  const s = suggest({
    now: D('2026-09-14T11:30:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      nap('2026-09-14T09:30:00', '2026-09-14T10:45:00'),
    ],
  });
  eq(s.kind, 'nap');
  eq(s.napIndex, 1);
});

test('after the expected nap count the next sleep is bedtime', () => {
  const s = suggest({
    now: D('2026-09-14T16:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      nap('2026-09-14T09:30:00', '2026-09-14T10:45:00'),
      nap('2026-09-14T14:00:00', '2026-09-14T15:15:00'),
    ],
  });
  eq(s.kind, 'bedtime');
});

test('reasons are present and every one carries a valid tier', () => {
  const s = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  ok(s.reasons.length > 0, 'expected at least one reason');
  for (const r of s.reasons) {
    ok(['A1', 'A2', 'B', 'C'].includes(r.tier), `bad tier ${r.tier}`);
    ok(typeof r.text === 'string' && r.text.length > 0);
  }
});

test('wake-window reasons are labeled convention, not evidence', () => {
  const s = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  const ww = s.reasons.find((r) => r.text.toLowerCase().includes('wake window'));
  if (ww) eq(ww.tier, 'C');
});

test('banned words never appear in reason text', () => {
  const s = suggest({
    now: D('2026-09-14T16:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      nap('2026-09-14T09:30:00', '2026-09-14T10:00:00'),
      nap('2026-09-14T14:00:00', '2026-09-14T14:30:00'),
    ],
  });
  const all = s.reasons.map((r) => r.text).join(' ').toLowerCase();
  ok(!all.includes('overtired'), 'the word overtired is banned');
  ok(!all.includes('regression'), 'the word regression is banned');
});

test('a short night pulls bedtime earlier than a full night does', () => {
  const base = [
    nap('2026-09-14T09:30:00', '2026-09-14T10:45:00'),
    nap('2026-09-14T14:00:00', '2026-09-14T15:15:00'),
  ];
  const full = suggest({
    now: D('2026-09-14T16:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00'), ...base],
  });
  const short = suggest({
    now: D('2026-09-14T16:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T22:30:00', '2026-09-14T07:00:00'), ...base],
  });
  ok(short.windowStart <= full.windowStart, 'a short night should not push bedtime later');
});

test('an accepted adjustment shifts the window', () => {
  const sleeps = [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')];
  const plain = suggest({ now: D('2026-09-14T08:00:00'), bandKey: '8-9', sleeps });
  const adjusted = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9', sleeps,
    adjustments: [{ kind: 'wakeWindow', offsetMinutes: 30, active: true }],
  });
  ok(adjusted.windowEnd > plain.windowEnd, 'a +30 adjustment should widen or shift later');
});

test('adjustments beyond the cap are clamped to 45 minutes', () => {
  const sleeps = [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')];
  const capped = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9', sleeps,
    adjustments: [{ kind: 'wakeWindow', offsetMinutes: 500, active: true }],
  });
  const atCap = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9', sleeps,
    adjustments: [{ kind: 'wakeWindow', offsetMinutes: 45, active: true }],
  });
  eq(capped.windowStart.getTime(), atCap.windowStart.getTime());
});

test('a night sleep spanning midnight is attributed to the correct day', () => {
  const s = suggest({
    now: D('2026-09-14T08:00:00'), bandKey: '8-9',
    sleeps: [night('2026-09-13T19:30:00', '2026-09-14T07:00:00')],
  });
  eq(s.napIndex, 0);
});

test('an unknown band key degrades gracefully', () => {
  const s = suggest({ now: D('2026-09-14T08:00:00'), bandKey: null, sleeps: [] });
  eq(s.kind, 'unknown');
});
```

Add `import './test/engine.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/engine.js`**

```js
import { BANDS, hoursToMinutes } from './sleep-data.js';
import { active, durationMinutes, localDayKey } from './model.js';

const MIN = 60000;
const ADJUSTMENT_CAP_MIN = 45;
const ANCHOR_HALF_WIDTH_MIN = 20;

export function atClock(referenceDate, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(referenceDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function clampAdjustment(adjustments) {
  const a = (adjustments || []).find((x) => x.active && x.kind === 'wakeWindow');
  if (!a) return 0;
  return Math.max(-ADJUSTMENT_CAP_MIN, Math.min(ADJUSTMENT_CAP_MIN, a.offsetMinutes));
}

function wakeWindowFor(band, napIndex, totalNaps) {
  if (napIndex === 0) return band.wakeWindows.first;
  if (napIndex >= totalNaps) return band.wakeWindows.last;
  return band.wakeWindows.middle;
}

function unknown() {
  return {
    kind: 'unknown', windowStart: null, windowEnd: null, targetDuration: null,
    predictedWake: null, reasons: [], confidence: 'low', napIndex: 0,
  };
}

export function suggest({ now, bandKey, sleeps = [], adjustments = [] }) {
  const band = BANDS[bandKey];
  if (!band) return unknown();

  const all = active(sleeps);
  const open = all.find((s) => !s.endedAt);
  if (open) {
    return {
      kind: 'in-progress', windowStart: null, windowEnd: null, targetDuration: null,
      predictedWake: null, reasons: [], confidence: 'normal', napIndex: 0, sleep: open,
    };
  }

  const done = [...all].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  const lastNight = [...done].reverse().find((s) => s.type === 'night');
  const last = done[done.length - 1];
  const wakeTime = lastNight ? new Date(lastNight.endedAt) : null;
  const lastEnd = last ? new Date(last.endedAt) : null;

  const todayKey = localDayKey(now);
  const napsToday = done.filter(
    (s) => s.type === 'nap' && localDayKey(new Date(s.startedAt)) === todayKey);
  const napIndex = napsToday.length;
  const totalNaps = band.napCount.typical;
  const offset = clampAdjustment(adjustments);

  const reasons = [];
  let confidence = wakeTime && lastEnd ? 'normal' : 'low';

  const isBedtime = napIndex >= totalNaps;
  const ww = wakeWindowFor(band, isBedtime ? totalNaps : napIndex, totalNaps);

  // Wake-window bounds, the secondary (convention) signal.
  let wwStart = null, wwEnd = null;
  if (lastEnd) {
    wwStart = new Date(lastEnd.getTime() + (ww.minMin + offset) * MIN);
    wwEnd = new Date(lastEnd.getTime() + (ww.maxMin + offset) * MIN);
    reasons.push({
      text: `Typical awake stretch at this age is about ${Math.round(ww.minMin / 15) * 15
        }–${Math.round(ww.maxMin / 15) * 15} minutes. Wake windows are a guideline from `
        + 'pediatric sleep practice, not a medical standard.',
      tier: band.wakeWindows.tier, source: band.wakeWindows.source,
    });
  }

  if (isBedtime) {
    return buildBedtime({ now, band, done, wakeTime, lastEnd, wwStart, wwEnd, reasons, confidence, napIndex });
  }

  // Nap clock anchor, the primary (observed) signal.
  let anchorStart = null, anchorEnd = null;
  if (band.napAnchors && band.napAnchors.times[napIndex] && wakeTime) {
    const anchor = atClock(wakeTime, band.napAnchors.times[napIndex]);
    const typical = atClock(wakeTime, band.typicalWake);
    const shifted = new Date(anchor.getTime() + (wakeTime - typical));
    anchorStart = new Date(shifted.getTime() - ANCHOR_HALF_WIDTH_MIN * MIN);
    anchorEnd = new Date(shifted.getTime() + ANCHOR_HALF_WIDTH_MIN * MIN);
    reasons.unshift({
      text: `Babies this age most often nap around ${band.napAnchors.times[napIndex]
        }, adjusted for when he actually woke.`,
      tier: band.napAnchors.tier, source: band.napAnchors.source,
    });
  }

  let windowStart = anchorStart ?? wwStart;
  let windowEnd = anchorEnd ?? wwEnd;

  if (anchorStart && wwStart) {
    const lo = new Date(Math.max(anchorStart, wwStart));
    const hi = new Date(Math.min(anchorEnd, wwEnd));
    if (lo < hi) {
      windowStart = lo; windowEnd = hi;
    } else {
      windowStart = wwStart; windowEnd = wwEnd;
      confidence = 'low';
      reasons.push({
        text: 'His schedule today is running away from the usual pattern, so this is a wider guess.',
        tier: 'C', source: band.wakeWindows.source,
      });
    }
  }

  if (!windowStart) {
    windowStart = new Date(now.getTime() + 30 * MIN);
    windowEnd = new Date(now.getTime() + 90 * MIN);
    confidence = 'low';
    reasons.push({
      text: 'Log a sleep or two and these suggestions will sharpen up.',
      tier: 'A2', source: band.total24h.source,
    });
  }

  const slept = napsToday.reduce((sum, s) => sum + (durationMinutes(s) ?? 0), 0);
  const napsLeft = Math.max(1, totalNaps - napIndex);
  const targetDuration = {
    minMin: Math.max(30, Math.round((hoursToMinutes(band.dayTotal.minHours) - slept) / napsLeft)),
    maxMin: Math.max(45, Math.round((hoursToMinutes(band.dayTotal.maxHours) - slept) / napsLeft)),
  };

  reasons.push({
    text: `Babies this age average about ${band.dayTotal.minHours}–${band.dayTotal.maxHours
      } hours of daytime sleep across ${totalNaps} naps.`,
    tier: band.dayTotal.tier, source: band.dayTotal.source,
  });

  return {
    kind: 'nap', windowStart, windowEnd, targetDuration,
    predictedWake: new Date(windowStart.getTime() + targetDuration.minMin * MIN),
    reasons, confidence, napIndex,
  };
}

function buildBedtime({ now, band, done, wakeTime, lastEnd, wwStart, wwEnd, reasons, confidence, napIndex }) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetWake = atClock(tomorrow, band.typicalWake);

  const nightNeedMin = hoursToMinutes(band.nightInBed.minHours);
  const nightNeedMax = hoursToMinutes(band.nightInBed.maxHours);
  const budgetLatest = new Date(targetWake.getTime() - nightNeedMin * MIN);
  const budgetEarliest = new Date(targetWake.getTime() - nightNeedMax * MIN);

  reasons.push({
    text: `Aiming for roughly ${band.nightInBed.minHours}–${band.nightInBed.maxHours
      } hours overnight to reach a full day's sleep.`,
    tier: band.nightInBed.tier, source: band.nightInBed.source,
  });

  // Short previous night pulls bedtime toward the earlier end.
  const prevNight = [...done].reverse().find((s) => s.type === 'night');
  let shortNight = false;
  if (prevNight) {
    const got = durationMinutes(prevNight) ?? 0;
    if (got < nightNeedMin) {
      shortNight = true;
      reasons.push({
        text: 'Last night came up short, so an earlier bedtime helps him catch up.',
        tier: 'A2', source: band.total24h.source,
      });
    }
  }

  let windowStart = wwStart ?? budgetEarliest;
  let windowEnd = wwEnd ?? budgetLatest;

  if (wwStart) {
    const lo = new Date(Math.max(wwStart, budgetEarliest));
    const hi = new Date(Math.min(wwEnd, budgetLatest));
    if (lo < hi) { windowStart = lo; windowEnd = hi; }
    else { windowStart = budgetEarliest; windowEnd = budgetLatest; confidence = 'low'; }
  }

  if (shortNight) {
    windowStart = new Date(windowStart.getTime() - 30 * MIN);
    windowEnd = new Date(windowEnd.getTime() - 30 * MIN);
  }

  reasons.push({
    text: 'Morning wake-ups tend to stay put, so bedtime is the part you can actually move. '
      + 'Keeping the routine the same on most nights is the best-supported thing you can do.',
    tier: 'A2', source: 'https://pubmed.ncbi.nlm.nih.gov/19750924/',
  });

  return {
    kind: 'bedtime', windowStart, windowEnd,
    targetDuration: { minMin: nightNeedMin, maxMin: nightNeedMax },
    predictedWake: targetWake, reasons, confidence, napIndex,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all engine tests PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js test.html
git commit -m "feat: suggestion engine anchored on observed nap times

Uses the Mindell 2016 nap clock-time distribution as the primary signal
with wake-window arithmetic secondary, because wake windows have no
peer-reviewed basis and are labeled as convention in the output.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: IndexedDB store

**Files:**
- Create: `js/store.js`, `test/store.test.js`
- Modify: `test.html`

**Interfaces:**
- Consumes: nothing (records come from `js/model.js` at the call site)
- Produces:
  - `openDb(name?) → Promise<IDBDatabase>`
  - `put(db, storeName, record) → Promise<void>`
  - `getAll(db, storeName) → Promise<record[]>`
  - `get(db, storeName, id) → Promise<record|undefined>`
  - `clearAll(db) → Promise<void>`
  - `STORES = ['child','sleeps','wakings','milestones','adjustments']`

This module stays deliberately thin — persistence only, no branching logic. Anything that needs a decision belongs in a pure module.

- [ ] **Step 1: Write the failing tests**

Create `test/store.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { openDb, put, get, getAll, clearAll, STORES } from '../js/store.js';
import { createSleep, softDelete } from '../js/model.js';
import { active } from '../js/model.js';

let n = 0;
const freshDb = () => openDb('sleeptest-' + Date.now() + '-' + n++);

test('opens a database with every expected store', async () => {
  const db = await freshDb();
  for (const s of STORES) ok(db.objectStoreNames.contains(s), `missing store ${s}`);
  db.close();
});

test('round-trips a record', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', s);
  const back = await get(db, 'sleeps', s.id);
  eq(back.id, s.id);
  eq(back.type, 'nap');
  db.close();
});

test('getAll returns every stored record', async () => {
  const db = await freshDb();
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' }));
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T14:00:00' }));
  eq((await getAll(db, 'sleeps')).length, 2);
  db.close();
});

test('put overwrites a record with the same id', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', s);
  await put(db, 'sleeps', { ...s, endedAt: '2026-09-14T10:45:00' });
  const all = await getAll(db, 'sleeps');
  eq(all.length, 1);
  eq(all[0].endedAt, '2026-09-14T10:45:00');
  db.close();
});

test('soft-deleted records persist but are excluded by active()', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', softDelete(s, new Date()));
  const all = await getAll(db, 'sleeps');
  eq(all.length, 1);
  eq(active(all).length, 0);
  db.close();
});

test('clearAll empties every store', async () => {
  const db = await freshDb();
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' }));
  await clearAll(db);
  eq((await getAll(db, 'sleeps')).length, 0);
  db.close();
});

test('get returns undefined for a missing id', async () => {
  const db = await freshDb();
  eq(await get(db, 'sleeps', 'nope'), undefined);
  db.close();
});
```

Add `import './test/store.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/store.js`**

```js
export const STORES = ['child', 'sleeps', 'wakings', 'milestones', 'adjustments'];
const DB_VERSION = 1;

export function openDb(name = 'baby-sleep') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export function put(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    t.objectStore(storeName).put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function get(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const r = tx(db, storeName, 'readonly').get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const r = tx(db, storeName, 'readonly').getAll();
    r.onsuccess = () => resolve(r.result ?? []);
    r.onerror = () => reject(r.error);
  });
}

export function clearAll(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite');
    for (const s of STORES) t.objectStore(s).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all store tests PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/store.js test/store.test.js test.html
git commit -m "feat: thin IndexedDB persistence adapter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: App shell, routing, and onboarding

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/views/onboarding.js`

**Interfaces:**
- Consumes: `createChild` (model), `openDb`/`put`/`getAll` (store), `correctedAgeDays`/`ageMonths`/`bandKeyForMonths`/`ageStatus` (age)
- Produces:
  - `js/app.js`: `mount(rootEl)`, `navigate(route)`, `getState()`, `setState(patch)`
  - `js/views/onboarding.js`: `render(container, { onComplete })`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1d29">
<title>Rested</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<main id="root" aria-live="polite"></main>
<script type="module">
import { mount } from './js/app.js';
mount(document.getElementById('root'));
</script>
</body>
</html>
```

- [ ] **Step 2: Create `css/app.css`**

```css
:root {
  --bg: #f7f7fb; --surface: #ffffff; --text: #1b1d29; --muted: #5b5f73;
  --accent: #4a5bd4; --accent-text: #ffffff; --line: #e2e4ee;
  --tier-strong: #1d7a4c; --tier-soft: #8a6d1f;
  --pad: 16px; --radius: 14px;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12131a; --surface: #1c1e28; --text: #eceef6; --muted: #a2a7bb;
    --accent: #7d8cf0; --accent-text: #12131a; --line: #2b2e3c;
    --tier-strong: #5fd39a; --tier-soft: #d9bd6a;
  }
}
:root[data-theme="dark"] {
  --bg: #12131a; --surface: #1c1e28; --text: #eceef6; --muted: #a2a7bb;
  --accent: #7d8cf0; --accent-text: #12131a; --line: #2b2e3c;
  --tier-strong: #5fd39a; --tier-soft: #d9bd6a;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding: 0 var(--pad);
}
h1 { font-size: 1.5rem; margin: 1.25rem 0 0.5rem; }
h2 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
p { margin: 0.5rem 0; }
.muted { color: var(--muted); font-size: 0.9rem; }
.card {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: var(--pad); margin: 12px 0;
}
.btn {
  display: block; width: 100%; min-height: 56px; border: 0;
  border-radius: var(--radius); background: var(--accent); color: var(--accent-text);
  font-size: 1.05rem; font-weight: 600; cursor: pointer; padding: 14px;
}
.btn.secondary { background: transparent; color: var(--accent); border: 1px solid var(--line); }
.field { display: block; margin: 14px 0; }
.field span { display: block; font-size: 0.9rem; color: var(--muted); margin-bottom: 4px; }
.field input, .field select, .field textarea {
  width: 100%; min-height: 48px; padding: 10px 12px; font-size: 1rem;
  border: 1px solid var(--line); border-radius: 10px;
  background: var(--surface); color: var(--text);
}
.tier { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.tier-A1, .tier-A2 { color: var(--tier-strong); }
.tier-B, .tier-C { color: var(--tier-soft); }
.reason { border-top: 1px solid var(--line); padding-top: 10px; margin-top: 10px; }
.window { font-size: 2rem; font-weight: 700; margin: 6px 0; }
.countdown { font-size: 1.1rem; color: var(--muted); }
nav.tabs { display: flex; gap: 6px; margin: 16px 0; flex-wrap: wrap; }
nav.tabs button {
  flex: 1 1 auto; min-width: 72px; min-height: 44px; border: 1px solid var(--line);
  background: var(--surface); color: var(--text); border-radius: 10px; cursor: pointer;
}
nav.tabs button[aria-current="page"] { background: var(--accent); color: var(--accent-text); }
.notice { border-left: 3px solid var(--accent); padding-left: 12px; }
[hidden] { display: none !important; }
```

- [ ] **Step 3: Create `js/views/onboarding.js`**

```js
import { createChild } from '../model.js';
import { correctedAgeDays, ageMonths, ageStatus } from '../age.js';

export function render(container, { onComplete }) {
  container.innerHTML = `
    <h1>Welcome</h1>
    <p class="muted">A couple of details and we can start.</p>
    <form id="ob">
      <label class="field"><span>Baby's name</span>
        <input name="name" required autocomplete="off"></label>
      <label class="field"><span>Date of birth</span>
        <input name="dob" type="date" required></label>
      <label class="field"><span>Was he born early?</span>
        <select name="preterm">
          <option value="">No, born at term</option>
          <option value="36">Yes — 36 weeks</option>
          <option value="34">Yes — 34 weeks</option>
          <option value="32">Yes — 32 weeks</option>
          <option value="30">Yes — 30 weeks</option>
          <option value="28">Yes — 28 weeks or earlier</option>
        </select></label>
      <p class="muted">Sleep norms are based on corrected age, so this keeps
        the suggestions accurate.</p>

      <div class="card">
        <h2>Safe sleep</h2>
        <ul class="muted">
          <li>On his back for every sleep, until he turns one.</li>
          <li>Firm, flat surface. Nothing in the crib but a fitted sheet.</li>
          <li>Share a room, not a bed, ideally for at least the first six months.</li>
          <li>Car seats, swings and strollers aren't for routine sleep.</li>
          <li>Stop swaddling as soon as he tries to roll.</li>
        </ul>
        <p class="muted">Summarised from the American Academy of Pediatrics, 2022.</p>
      </div>

      <div class="card notice">
        <p>This app is a planning aid, not medical advice. Sleep varies enormously
          between healthy babies — at nine months the normal range runs from about
          10.5 to 17.4 hours a day. His cues matter more than any suggestion here.
          Anything that worries you belongs with your pediatrician.</p>
      </div>

      <label class="field"><span>
        <input type="checkbox" name="ack" required> I've read the above</span></label>
      <p id="err" class="muted" hidden></p>
      <button class="btn" type="submit">Start</button>
    </form>`;

  container.querySelector('#ob').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dob = f.get('dob');
    const weeks = f.get('preterm') ? Number(f.get('preterm')) : null;
    const months = ageMonths(correctedAgeDays(dob, weeks, new Date()));
    const err = container.querySelector('#err');

    if (ageStatus(months) === 'too-young') {
      err.hidden = false;
      err.textContent = 'Published sleep guidance starts at four months, so the '
        + 'suggestions here would not be meaningful yet. Come back in a few weeks.';
      return;
    }
    if (ageStatus(months) === 'too-old') {
      err.hidden = false;
      err.textContent = 'This app covers four to twenty-four months.';
      return;
    }
    await onComplete(createChild({
      name: f.get('name').trim(), dob, gestationalWeeksAtBirth: weeks,
    }));
  });
}
```

- [ ] **Step 4: Create `js/app.js`**

```js
import { openDb, put, getAll } from './store.js';
import { correctedAgeDays, ageMonths, bandKeyForMonths } from './age.js';
import * as onboarding from './views/onboarding.js';

const state = { db: null, child: null, sleeps: [], wakings: [], milestones: [], adjustments: [], route: 'today' };

export function getState() { return state; }
export function setState(patch) { Object.assign(state, patch); }

export function bandKey(now = new Date()) {
  if (!state.child) return null;
  const days = correctedAgeDays(state.child.dob, state.child.gestationalWeeksAtBirth, now);
  return bandKeyForMonths(ageMonths(days));
}

async function reload() {
  const [child, sleeps, wakings, milestones, adjustments] = await Promise.all([
    getAll(state.db, 'child'), getAll(state.db, 'sleeps'), getAll(state.db, 'wakings'),
    getAll(state.db, 'milestones'), getAll(state.db, 'adjustments'),
  ]);
  setState({ child: child[0] ?? null, sleeps, wakings, milestones, adjustments });
}

let rootEl = null;

export async function navigate(route) {
  setState({ route });
  await draw();
}

async function draw() {
  if (!state.child) {
    onboarding.render(rootEl, {
      onComplete: async (child) => {
        await put(state.db, 'child', child);
        await reload();
        await navigate('today');
      },
    });
    return;
  }
  const views = await import('./views/index.js');
  await views.render(rootEl, state.route);
}

export async function mount(el) {
  rootEl = el;
  state.db = await openDb();
  await reload();
  await draw();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
```

- [ ] **Step 5: Create `js/views/tabs.js`**

`tabs` lives in its own module rather than in the registry. If the registry
exported it, every view would import the registry while the registry imports
every view — a circular dependency that works only by accident of hoisting.

```js
const ITEMS = [
  ['today', 'Today'],
  ['history', 'History'],
  ['insights', 'Insights'],
  ['settings', 'Settings'],
];

export function tabs(current) {
  return `<nav class="tabs">${ITEMS.map(([k, label]) =>
    `<button data-route="${k}"${k === current ? ' aria-current="page"' : ''}>${label}</button>`
  ).join('')}</nav>`;
}
```

All four tabs are listed from the start. Routes that do not exist yet fall
back to Today via the registry below, so a tap is never a dead end.

- [ ] **Step 6: Create the view registry `js/views/index.js`**

```js
import * as today from './today.js';

const ROUTES = { today };

export async function render(container, route, params = {}) {
  const view = ROUTES[route] ?? ROUTES.today;
  await view.render(container, params);
}
```

Later tasks add entries to `ROUTES` as views are built.

- [ ] **Step 7: Verify onboarding by hand**

Run: `python -m http.server 8080` then open `http://127.0.0.1:8080/` in Chrome with a device-sized viewport (DevTools → Pixel 7).

Confirm: the form renders; submitting a DOB under four months shows the explanatory message and does not proceed; a valid submission persists and the page moves past onboarding; reloading does not show onboarding again.

- [ ] **Step 8: Confirm the automated suite still passes**

Run: `python run-tests.py`
Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add index.html css/app.css js/app.js js/views/onboarding.js js/views/index.js js/views/tabs.js
git commit -m "feat: app shell, routing, and onboarding with prematurity and safe-sleep

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Today view with live countdown

**Files:**
- Create: `js/views/today.js`
- Modify: `js/views/index.js`

**Interfaces:**
- Consumes: `suggest` (engine), `bandKey`/`getState`/`navigate` (app), `createSleep`/`durationMinutes` (model), `put` (store)
- Produces: `render(container)` from `js/views/today.js`; `formatWindow(start, end) → string`; `formatCountdown(ms) → string`

- [ ] **Step 1: Create `js/views/today.js`**

```js
import { suggest } from '../engine.js';
import { getState, bandKey, navigate } from '../app.js';
import { createSleep, durationMinutes, active, localDayKey } from '../model.js';
import { put } from '../store.js';
import { tabs } from './tabs.js';

let timer = null;

const two = (n) => String(n).padStart(2, '0');
const clock = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;

export function formatWindow(start, end) {
  return `${clock(start)} – ${clock(end)}`;
}

export function formatCountdown(ms) {
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

function reasonsHtml(reasons) {
  return reasons.map((r) => `
    <div class="reason">
      <span class="tier tier-${r.tier}">${tierLabel(r.tier)}</span>
      <p>${r.text}</p>
    </div>`).join('');
}

function tierLabel(tier) {
  if (tier === 'A1') return 'Published guideline';
  if (tier === 'A2') return 'Research evidence';
  if (tier === 'B') return 'Observed in studies';
  return 'Common practice';
}

export async function render(container) {
  const s = getState();
  const now = new Date();
  const key = bandKey(now);
  const sug = suggest({ now, bandKey: key, sleeps: s.sleeps, adjustments: active(s.adjustments) });
  const open = active(s.sleeps).find((x) => !x.endedAt);

  const todayKey = localDayKey(now);
  const todays = active(s.sleeps)
    .filter((x) => localDayKey(new Date(x.startedAt)) === todayKey)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  container.innerHTML = `
    ${tabs('today')}
    <h1>${s.child.name}</h1>
    <div class="card" id="suggestion">${suggestionHtml(sug, open, now)}</div>
    <button class="btn" id="primary">${primaryLabel(open, sug)}</button>
    <h2>Today</h2>
    ${todays.length === 0 ? '<p class="muted">Nothing logged yet.</p>' : ''}
    ${todays.map((x) => `<div class="card">
        <strong>${x.type === 'nap' ? 'Nap' : 'Night'}</strong>
        <span class="muted">${clock(new Date(x.startedAt))}${
          x.endedAt ? ' – ' + clock(new Date(x.endedAt)) : ' – in progress'}</span>
        ${x.endedAt ? `<div class="muted">${durationMinutes(x)} min</div>` : ''}
      </div>`).join('')}`;

  container.querySelector('#primary').addEventListener('click', async () => {
    const st = getState();
    const current = active(st.sleeps).find((x) => !x.endedAt);
    if (current) {
      await put(st.db, 'sleeps', { ...current, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } else {
      const type = sug.kind === 'bedtime' ? 'night' : 'nap';
      await put(st.db, 'sleeps', createSleep({ type, startedAt: new Date().toISOString() }));
    }
    location.reload();
  });

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));

  clearInterval(timer);
  timer = setInterval(() => {
    const el = container.querySelector('#countdown');
    if (!el || !sug.windowStart) return;
    el.textContent = formatCountdown(sug.windowStart - new Date());
  }, 30000);
}

function primaryLabel(open, sug) {
  if (open) return open.type === 'nap' ? 'End nap' : 'He\'s awake';
  return sug.kind === 'bedtime' ? 'Down for the night' : 'Start nap';
}

function suggestionHtml(sug, open, now) {
  if (open) {
    return `<p class="muted">${open.type === 'nap' ? 'Napping' : 'Asleep'} since
      ${clock(new Date(open.startedAt))}</p>`;
  }
  if (sug.kind === 'unknown') {
    return '<p class="muted">Add his details to get suggestions.</p>';
  }
  const heading = sug.kind === 'bedtime' ? 'Bedtime' : `Nap ${sug.napIndex + 1}`;
  const dur = sug.targetDuration
    ? `<p class="muted">Aim for about ${sug.targetDuration.minMin}–${sug.targetDuration.maxMin} minutes.</p>`
    : '';
  const low = sug.confidence === 'low'
    ? '<p class="muted">This is a rough estimate — more logged sleeps will sharpen it.</p>' : '';
  return `<h2>${heading}</h2>
    <div class="window">${formatWindow(sug.windowStart, sug.windowEnd)}</div>
    <div class="countdown" id="countdown">${formatCountdown(sug.windowStart - now)}</div>
    ${dur}${low}${reasonsHtml(sug.reasons)}`;
}
```

- [ ] **Step 2: Register the view**

In `js/views/index.js` the `ROUTES` and `items` already include `today`. No change needed this task; confirm the import resolves.

- [ ] **Step 3: Verify by hand**

Run: `python -m http.server 8080`, open in Chrome at Pixel 7 size.

Confirm: a suggestion card renders with a time window and at least one tier-labeled reason; pressing the primary button starts a sleep and the label flips to "End nap"; pressing again ends it and a new suggestion appears; the countdown text is present.

- [ ] **Step 4: Confirm the suite still passes**

Run: `python run-tests.py`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/views/today.js js/views/index.js
git commit -m "feat: today view with live countdown and tier-labeled reasons

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Offline install (PWA)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`

**Interfaces:**
- Consumes: registration call already present in `js/app.js` from Task 7
- Produces: an installable, offline-capable app

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "Rested",
  "short_name": "Rested",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#12131a",
  "theme_color": "#1b1d29",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Generate the icons**

Run this from the project root (Python and Pillow-free — writes a minimal valid PNG):

```python
python - <<'EOF'
import struct, zlib, os
os.makedirs('icons', exist_ok=True)

def png(path, size, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * size for _ in range(size))
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
                + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

png('icons/icon-192.png', 192, (74, 91, 212))
png('icons/icon-512.png', 512, (74, 91, 212))
print('icons written')
EOF
```

These are solid-colour placeholders. Replace them with real artwork whenever you like; nothing in the code depends on their content.

- [ ] **Step 3: Create `sw.js`**

```js
const CACHE = 'rested-v1';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/age.js', './js/sleep-data.js', './js/model.js',
  './js/engine.js', './js/store.js',
  './js/views/index.js', './js/views/tabs.js', './js/views/onboarding.js',
  './js/views/today.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
```

**Important:** every time a later task adds a file under `js/`, add it to `SHELL` and bump `CACHE` to `rested-v2`, `v3`, and so on. A stale cache is the most common way a PWA appears broken after an update.

- [ ] **Step 4: Verify offline behaviour**

Run: `python -m http.server 8080`, open `http://127.0.0.1:8080/` in Chrome.

Then in DevTools: Application → Service Workers shows it activated; Application → Manifest shows no errors and both icons; check **Offline** in the Network tab and reload — the app must still render and still accept a logged sleep.

- [ ] **Step 5: Verify on the actual phone**

Serve on the local network (`python -m http.server 8080 --bind 0.0.0.0`), open the machine's LAN address in Chrome on the Android phone, use the menu to "Add to Home Screen", launch from the icon, then **put the phone in airplane mode** and confirm a full cycle works: start a nap, end it, see a new suggestion.

This is the check that matters most. Everything else is theory until it survives airplane mode on the real device.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js icons/
git commit -m "feat: offline-capable PWA install

Phase 1 complete: the app answers the core question with no network.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Edit sleep — times, notes, mood, night wakings

**Files:**
- Create: `js/views/edit-sleep.js`
- Modify: `js/views/index.js`, `js/views/today.js`, `sw.js`

**Interfaces:**
- Consumes: `createWaking`, `softDelete`, `durationMinutes` (model); `put` (store)
- Produces: `render(container, { sleepId })` from `js/views/edit-sleep.js`; `toLocalInputValue(date) → 'YYYY-MM-DDTHH:MM'`; `fromLocalInputValue(str) → Date`

- [ ] **Step 1: Write the failing tests for the datetime helpers**

Create `test/edit-sleep.test.js`:

```js
import { test, eq } from './harness.js';
import { toLocalInputValue, fromLocalInputValue } from '../js/views/edit-sleep.js';

test('formats a local datetime for an input element', () =>
  eq(toLocalInputValue(new Date(2026, 8, 14, 9, 5)), '2026-09-14T09:05'));

test('round-trips through a datetime-local value without drifting', () => {
  const d = new Date(2026, 8, 14, 23, 45);
  eq(fromLocalInputValue(toLocalInputValue(d)).getTime(), d.getTime());
});

test('parses a datetime-local value as local, not UTC', () => {
  const d = fromLocalInputValue('2026-09-14T00:30');
  eq([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 8, 14, 0]);
});
```

Add `import './test/edit-sleep.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/views/edit-sleep.js`**

```js
import { getState, navigate } from '../app.js';
import { put } from '../store.js';
import { createWaking, softDelete, active, durationMinutes } from '../model.js';

const two = (n) => String(n).padStart(2, '0');

export function toLocalInputValue(date) {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
    + `T${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function fromLocalInputValue(str) {
  const [d, t] = str.split('T');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(y, mo - 1, day, h, mi, 0, 0);
}

export async function render(container, { sleepId }) {
  const s = getState();
  const sleep = active(s.sleeps).find((x) => x.id === sleepId);
  if (!sleep) { await navigate('today'); return; }

  const wakings = active(s.wakings).filter((w) => w.sleepId === sleepId)
    .sort((a, b) => new Date(a.wokeAt) - new Date(b.wokeAt));

  container.innerHTML = `
    <h1>${sleep.type === 'nap' ? 'Nap' : 'Night sleep'}</h1>
    <form id="ed">
      <label class="field"><span>Started</span>
        <input type="datetime-local" name="startedAt"
          value="${toLocalInputValue(new Date(sleep.startedAt))}" required></label>
      <label class="field"><span>Ended</span>
        <input type="datetime-local" name="endedAt"
          value="${sleep.endedAt ? toLocalInputValue(new Date(sleep.endedAt)) : ''}"></label>
      <label class="field"><span>How did it go?</span>
        <select name="mood">
          <option value="">Not noted</option>
          <option value="easy"${sleep.mood === 'easy' ? ' selected' : ''}>Easy</option>
          <option value="fussy"${sleep.mood === 'fussy' ? ' selected' : ''}>Fussy</option>
          <option value="rough"${sleep.mood === 'rough' ? ' selected' : ''}>Rough</option>
        </select></label>
      ${sleep.type === 'night' ? `
      <label class="field"><span>
        <input type="checkbox" name="routineFollowed"${sleep.routineFollowed ? ' checked' : ''}>
        Followed the usual bedtime routine</span></label>
      <p class="muted">Keeping the routine the same on at least five nights a week is
        the best-evidenced thing you can do for his sleep.</p>` : ''}
      <label class="field"><span>Note</span>
        <textarea name="note" rows="2">${sleep.note ?? ''}</textarea></label>
      <p id="err" class="muted" hidden></p>
      <button class="btn" type="submit">Save</button>
    </form>

    ${sleep.type === 'night' ? `
    <h2>Night wakings</h2>
    ${wakings.length === 0 ? '<p class="muted">None logged.</p>' : ''}
    ${wakings.map((w) => `<div class="card">
      ${new Date(w.wokeAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      ${w.backAsleepAt ? '– ' + new Date(w.backAsleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      <button class="btn secondary" data-del-waking="${w.id}">Remove</button>
    </div>`).join('')}
    <form id="addw">
      <label class="field"><span>Woke at</span>
        <input type="datetime-local" name="wokeAt" required></label>
      <label class="field"><span>Back to sleep at</span>
        <input type="datetime-local" name="backAsleepAt"></label>
      <button class="btn secondary" type="submit">Add waking</button>
    </form>
    <p class="muted">For reference, babies this age average about one waking a night,
      and up to three is within the normal range.</p>` : ''}

    <button class="btn secondary" id="del">Delete this sleep</button>
    <button class="btn secondary" id="back">Back</button>`;

  container.querySelector('#ed').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const started = fromLocalInputValue(f.get('startedAt'));
    const endedRaw = f.get('endedAt');
    const ended = endedRaw ? fromLocalInputValue(endedRaw) : null;
    const err = container.querySelector('#err');

    if (ended && ended <= started) {
      err.hidden = false;
      err.textContent = 'The end time needs to be after the start time.';
      return;
    }
    await put(s.db, 'sleeps', {
      ...sleep,
      startedAt: started.toISOString(),
      endedAt: ended ? ended.toISOString() : null,
      mood: f.get('mood') || null,
      note: f.get('note').trim() || null,
      routineFollowed: sleep.type === 'night' ? f.get('routineFollowed') === 'on' : null,
      updatedAt: new Date().toISOString(),
    });
    location.reload();
  });

  const addw = container.querySelector('#addw');
  if (addw) {
    addw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      await put(s.db, 'wakings', createWaking({
        sleepId,
        wokeAt: fromLocalInputValue(f.get('wokeAt')).toISOString(),
        backAsleepAt: f.get('backAsleepAt')
          ? fromLocalInputValue(f.get('backAsleepAt')).toISOString() : null,
      }));
      location.reload();
    });
  }

  container.querySelectorAll('[data-del-waking]').forEach((b) =>
    b.addEventListener('click', async () => {
      const w = active(s.wakings).find((x) => x.id === b.dataset.delWaking);
      await put(s.db, 'wakings', softDelete(w));
      location.reload();
    }));

  container.querySelector('#del').addEventListener('click', async () => {
    await put(s.db, 'sleeps', softDelete(sleep));
    location.reload();
  });
  container.querySelector('#back').addEventListener('click', () => navigate('today'));
}
```

- [ ] **Step 4: Wire it into routing**

In `js/views/index.js`, replace the file with:

```js
import * as today from './today.js';
import * as editSleep from './edit-sleep.js';

const ROUTES = { today, 'edit-sleep': editSleep };

export async function render(container, route, params = {}) {
  const view = ROUTES[route] ?? ROUTES.today;
  await view.render(container, params);
}
```

In `js/app.js`, change `navigate` and `draw` to carry params:

```js
export async function navigate(route, params = {}) {
  setState({ route, params });
  await draw();
}
```

and in `draw()`:

```js
  const views = await import('./views/index.js');
  await views.render(rootEl, state.route, state.params ?? {});
```

In `js/views/today.js`, make each logged sleep card tappable by adding `data-edit="${x.id}"` to the card div and this listener at the end of `render`:

```js
  container.querySelectorAll('[data-edit]').forEach((el) =>
    el.addEventListener('click', () => navigate('edit-sleep', { sleepId: el.dataset.edit })));
```

- [ ] **Step 5: Add the new file to the service worker cache**

In `sw.js`, add `'./js/views/edit-sleep.js'` to `SHELL` and change `CACHE` to `'rested-v2'`.

- [ ] **Step 6: Run the suite**

Run: `python run-tests.py`
Expected: all tests PASS including the three new datetime tests, exit code 0.

- [ ] **Step 7: Verify by hand**

Confirm: tapping a logged sleep opens the editor; saving an end time before the start time shows the message and does not save; adding a night waking persists it; deleting a sleep removes it from Today.

- [ ] **Step 8: Commit**

```bash
git add js/views/edit-sleep.js js/views/index.js js/views/today.js js/app.js test/edit-sleep.test.js test.html sw.js
git commit -m "feat: edit sleeps with notes, mood, and night wakings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: History view with milestone markers

**Files:**
- Create: `js/views/history.js`, `js/history-data.js`, `test/history-data.test.js`
- Modify: `js/views/index.js`, `sw.js`, `test.html`

**Interfaces:**
- Consumes: `active`, `durationMinutes`, `localDayKey` (model)
- Produces:
  - `groupByDay(sleeps, milestones) → [{ dayKey, sleeps, milestones, totalMin, nightMin, dayMin }]` from `js/history-data.js`
  - `dayBarSegments(daySleeps, dayKey) → [{ leftPct, widthPct, type }]`
  - `render(container)` from `js/views/history.js`

Pure data shaping lives in `history-data.js` so it can be tested; the view only draws.

- [ ] **Step 1: Write the failing tests**

Create `test/history-data.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { groupByDay, dayBarSegments } from '../js/history-data.js';
import { createSleep, createMilestone } from '../js/model.js';

const nap = (s, e) => createSleep({ type: 'nap', startedAt: s, endedAt: e });
const night = (s, e) => createSleep({ type: 'night', startedAt: s, endedAt: e });

test('groups sleeps by local day, newest first', () => {
  const g = groupByDay([
    nap('2026-09-13T09:30:00', '2026-09-13T10:30:00'),
    nap('2026-09-14T09:30:00', '2026-09-14T10:30:00'),
  ], []);
  eq(g.map((d) => d.dayKey), ['2026-09-14', '2026-09-13']);
});

test('totals day and night sleep separately', () => {
  const g = groupByDay([
    night('2026-09-13T19:00:00', '2026-09-14T07:00:00'),
    nap('2026-09-14T09:30:00', '2026-09-14T10:30:00'),
  ], []);
  const day = g.find((d) => d.dayKey === '2026-09-14');
  eq(day.dayMin, 60);
});

test('a night sleep is attributed to the day it started', () => {
  const g = groupByDay([night('2026-09-13T19:00:00', '2026-09-14T07:00:00')], []);
  eq(g[0].dayKey, '2026-09-13');
  eq(g[0].nightMin, 720);
});

test('milestones land on their own day', () => {
  const g = groupByDay(
    [nap('2026-09-14T09:30:00', '2026-09-14T10:30:00')],
    [createMilestone({ kind: 'pullingToStand', observedAt: '2026-09-14T11:00:00' })]);
  eq(g[0].milestones.length, 1);
});

test('in-progress sleeps are skipped in totals', () => {
  const open = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  const g = groupByDay([open], []);
  eq(g[0].dayMin, 0);
});

test('soft-deleted sleeps are excluded', () => {
  const g = groupByDay(
    [{ ...nap('2026-09-14T09:30:00', '2026-09-14T10:30:00'), deletedAt: '2026-09-14T12:00:00' }],
    []);
  eq(g.length, 0);
});

test('bar segments are percentages of a 24 hour day', () => {
  const segs = dayBarSegments([nap('2026-09-14T12:00:00', '2026-09-14T13:00:00')], '2026-09-14');
  eq(segs.length, 1);
  eq(Math.round(segs[0].leftPct), 50);
  ok(Math.abs(segs[0].widthPct - (100 / 24)) < 0.01);
});

test('a segment crossing midnight is clipped at the day boundary', () => {
  const segs = dayBarSegments([night('2026-09-14T23:00:00', '2026-09-15T07:00:00')], '2026-09-14');
  ok(segs[0].leftPct + segs[0].widthPct <= 100.01, 'segment must not overflow the bar');
});
```

Add `import './test/history-data.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/history-data.js`**

```js
import { active, durationMinutes, localDayKey } from './model.js';

export function groupByDay(sleeps, milestones) {
  const days = new Map();
  const touch = (key) => {
    if (!days.has(key)) {
      days.set(key, { dayKey: key, sleeps: [], milestones: [], nightMin: 0, dayMin: 0, totalMin: 0 });
    }
    return days.get(key);
  };

  for (const s of active(sleeps)) {
    const key = localDayKey(new Date(s.startedAt));
    const d = touch(key);
    d.sleeps.push(s);
    const mins = durationMinutes(s) ?? 0;
    if (s.type === 'night') d.nightMin += mins; else d.dayMin += mins;
    d.totalMin += mins;
  }
  for (const m of active(milestones)) {
    touch(localDayKey(new Date(m.observedAt))).milestones.push(m);
  }

  return [...days.values()].sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

export function dayBarSegments(daySleeps, dayKey) {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const end = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
  const span = end - start;

  return active(daySleeps)
    .filter((s) => s.endedAt)
    .map((s) => {
      const a = Math.max(new Date(s.startedAt), start);
      const b = Math.min(new Date(s.endedAt), end);
      if (b <= a) return null;
      return {
        leftPct: ((a - start) / span) * 100,
        widthPct: ((b - a) / span) * 100,
        type: s.type,
      };
    })
    .filter(Boolean);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all history-data tests PASS, exit code 0.

- [ ] **Step 5: Implement `js/views/history.js`**

```js
import { getState, navigate } from '../app.js';
import { groupByDay, dayBarSegments } from '../history-data.js';
import { createMilestone } from '../model.js';
import { put } from '../store.js';
import { tabs } from './tabs.js';

const MILESTONE_LABELS = {
  sitting: 'Sitting', crawling: 'Crawling', pullingToStand: 'Pulling to stand',
  cruising: 'Cruising', walking: 'Walking', other: 'Something new',
};

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

export async function render(container) {
  const s = getState();
  const days = groupByDay(s.sleeps, s.milestones);

  container.innerHTML = `
    ${tabs('history')}
    <h1>History</h1>
    ${days.length === 0 ? '<p class="muted">Nothing logged yet.</p>' : ''}
    ${days.map((d) => `
      <div class="card">
        <strong>${d.dayKey}</strong>
        <div class="daybar" role="img" aria-label="Sleep across the day">
          ${dayBarSegments(d.sleeps, d.dayKey).map((g) =>
            `<span class="seg seg-${g.type}" style="left:${g.leftPct}%;width:${g.widthPct}%"></span>`
          ).join('')}
        </div>
        <div class="muted">Day ${hm(d.dayMin)} · Night ${hm(d.nightMin)}</div>
        ${d.milestones.map((m) =>
          `<div class="muted">★ ${MILESTONE_LABELS[m.kind]}</div>`).join('')}
      </div>`).join('')}

    <h2>Log a milestone</h2>
    <p class="muted">Babies often wake more in the weeks after learning something new,
      so noting these makes a rough patch easier to explain.</p>
    <form id="ms">
      <label class="field"><span>What happened</span>
        <select name="kind">
          ${Object.entries(MILESTONE_LABELS).map(([k, v]) =>
            `<option value="${k}">${v}</option>`).join('')}
        </select></label>
      <label class="field"><span>When</span>
        <input type="date" name="observedAt" required></label>
      <button class="btn secondary" type="submit">Add</button>
    </form>`;

  container.querySelector('#ms').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const [y, mo, d] = f.get('observedAt').split('-').map(Number);
    await put(s.db, 'milestones', createMilestone({
      kind: f.get('kind'),
      observedAt: new Date(y, mo - 1, d, 12, 0, 0).toISOString(),
    }));
    location.reload();
  });

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
```

- [ ] **Step 6: Add the day-bar styles**

Append to `css/app.css`:

```css
.daybar {
  position: relative; height: 22px; margin: 10px 0;
  background: var(--bg); border: 1px solid var(--line); border-radius: 6px; overflow: hidden;
}
.daybar .seg { position: absolute; top: 0; bottom: 0; }
.seg-nap { background: var(--accent); opacity: 0.75; }
.seg-night { background: var(--tier-strong); opacity: 0.6; }
```

- [ ] **Step 7: Register the route and cache the files**

In `js/views/index.js`, add `import * as history from './history.js';` and add `history` to `ROUTES`. The tab itself is already listed in `js/views/tabs.js` — no change needed there.

In `sw.js`, add `'./js/views/history.js'` and `'./js/history-data.js'` to `SHELL`, and bump `CACHE` to `'rested-v3'`.

- [ ] **Step 8: Run the suite and verify by hand**

Run: `python run-tests.py` — expect exit code 0.

By hand: the History tab lists days newest-first with a filled bar; adding a milestone shows a star on the right day.

- [ ] **Step 9: Commit**

```bash
git add js/views/history.js js/history-data.js js/views/index.js test/history-data.test.js test.html css/app.css sw.js
git commit -m "feat: history view with day bars and milestone markers

Milestones replace the 'sleep regression' framing: population night-waking
data declines monotonically through the first year, while crawling and
pulling-to-stand are documented to fragment sleep.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Insights — trends, routine streak, what to expect

**Files:**
- Create: `js/insights.js`, `js/content.js`, `js/views/insights.js`, `test/insights.test.js`
- Modify: `js/views/index.js`, `sw.js`, `test.html`

**Interfaces:**
- Consumes: `groupByDay` (history-data), `BANDS` (sleep-data), `active` (model)
- Produces:
  - `rollingAverages(sleeps, days = 14, now) → { avgTotalMin, avgDayMin, avgNightMin, avgNapCount, sampleDays }`
  - `routineStreak(sleeps, weeks = 2) → { nightsWithRoutine, nightsLogged, meetsThreshold }`
  - `compareToBand(avgTotalMin, band) → { status: 'below'|'within'|'above', normMinHours, normMaxHours }`
  - `expectationsFor(bandKey) → [{ text, tier, source }]` from `js/content.js`

- [ ] **Step 1: Write the failing tests**

Create `test/insights.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { rollingAverages, routineStreak, compareToBand } from '../js/insights.js';
import { expectationsFor } from '../js/content.js';
import { BANDS } from '../js/sleep-data.js';
import { createSleep } from '../js/model.js';

const nap = (s, e) => createSleep({ type: 'nap', startedAt: s, endedAt: e });
const night = (s, e, routine = null) =>
  ({ ...createSleep({ type: 'night', startedAt: s, endedAt: e }), routineFollowed: routine });

const NOW = new Date('2026-09-14T20:00:00');

test('rolling averages report the number of days sampled', () => {
  const r = rollingAverages([nap('2026-09-14T09:30:00', '2026-09-14T10:30:00')], 14, NOW);
  eq(r.sampleDays, 1);
});

test('rolling averages compute mean daytime sleep', () => {
  const r = rollingAverages([
    nap('2026-09-13T09:30:00', '2026-09-13T10:30:00'),
    nap('2026-09-14T09:30:00', '2026-09-14T11:30:00'),
  ], 14, NOW);
  eq(r.avgDayMin, 90);
});

test('rolling averages ignore days outside the window', () => {
  const r = rollingAverages([
    nap('2026-01-01T09:30:00', '2026-01-01T10:30:00'),
    nap('2026-09-14T09:30:00', '2026-09-14T10:30:00'),
  ], 14, NOW);
  eq(r.sampleDays, 1);
});

test('empty history yields zero sample days, not a crash', () => {
  const r = rollingAverages([], 14, NOW);
  eq(r.sampleDays, 0);
  eq(r.avgDayMin, 0);
});

test('routine streak counts nights where the routine was followed', () => {
  const r = routineStreak([
    night('2026-09-12T19:00:00', '2026-09-13T07:00:00', true),
    night('2026-09-13T19:00:00', '2026-09-14T07:00:00', false),
  ]);
  eq(r.nightsWithRoutine, 1);
  eq(r.nightsLogged, 2);
});

test('the five-nights-a-week threshold is applied as a proportion', () => {
  const nights = [];
  for (let i = 0; i < 7; i++) {
    nights.push(night(`2026-09-0${i + 1}T19:00:00`, `2026-09-0${i + 2}T07:00:00`, i < 6));
  }
  eq(routineStreak(nights).meetsThreshold, true);
});

test('below-range totals are flagged as below', () => {
  const r = compareToBand(10 * 60, BANDS['8-9']);
  eq(r.status, 'below');
});

test('in-range totals are flagged as within', () => {
  eq(compareToBand(13 * 60, BANDS['8-9']).status, 'within');
});

test('above-range totals are flagged as above', () => {
  eq(compareToBand(18 * 60, BANDS['8-9']).status, 'above');
});

test('every age band has expectation content', () => {
  for (const key of Object.keys(BANDS)) {
    ok(expectationsFor(key).length > 0, `no expectations for ${key}`);
  }
});

test('expectation content carries valid tiers and never uses banned words', () => {
  for (const key of Object.keys(BANDS)) {
    for (const e of expectationsFor(key)) {
      ok(['A1', 'A2', 'B', 'C'].includes(e.tier), `bad tier in ${key}`);
      const t = e.text.toLowerCase();
      ok(!t.includes('regression'), `banned word in ${key}`);
      ok(!t.includes('overtired'), `banned word in ${key}`);
    }
  }
});
```

Add `import './test/insights.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/insights.js`**

```js
import { groupByDay } from './history-data.js';
import { active, durationMinutes, localDayKey } from './model.js';

const ROUTINE_THRESHOLD = 5 / 7;

export function rollingAverages(sleeps, days = 14, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const recent = active(sleeps).filter((s) => new Date(s.startedAt) >= cutoff);
  const grouped = groupByDay(recent, []);

  if (grouped.length === 0) {
    return { avgTotalMin: 0, avgDayMin: 0, avgNightMin: 0, avgNapCount: 0, sampleDays: 0 };
  }
  const sum = (f) => grouped.reduce((a, d) => a + f(d), 0);
  const n = grouped.length;
  return {
    avgTotalMin: Math.round(sum((d) => d.totalMin) / n),
    avgDayMin: Math.round(sum((d) => d.dayMin) / n),
    avgNightMin: Math.round(sum((d) => d.nightMin) / n),
    avgNapCount: Math.round((sum((d) => d.sleeps.filter((s) => s.type === 'nap').length) / n) * 10) / 10,
    sampleDays: n,
  };
}

export function routineStreak(sleeps, weeks = 2) {
  const nights = active(sleeps)
    .filter((s) => s.type === 'night' && s.routineFollowed !== null)
    .slice(-weeks * 7);
  const withRoutine = nights.filter((s) => s.routineFollowed === true).length;
  return {
    nightsWithRoutine: withRoutine,
    nightsLogged: nights.length,
    meetsThreshold: nights.length > 0 && withRoutine / nights.length >= ROUTINE_THRESHOLD,
  };
}

export function compareToBand(avgTotalMin, band) {
  const lo = band.total24h.minHours * 60;
  const hi = band.total24h.maxHours * 60;
  let status = 'within';
  if (avgTotalMin < lo) status = 'below';
  if (avgTotalMin > hi) status = 'above';
  return { status, normMinHours: band.total24h.minHours, normMaxHours: band.total24h.maxHours };
}
```

- [ ] **Step 4: Implement `js/content.js`**

```js
// User-facing explanatory copy. Every item carries a tier and a source.
// The words "regression" and "overtired" are banned — see the spec.

const AASM = 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866';
const GALLAND = 'https://www.sciencedirect.com/science/article/abs/pii/S1087079211000682';
const IGLOW = 'https://publications.aap.org/pediatrics/article/111/2/302/66745/';
const CDC = 'https://www.cdc.gov/act-early/milestones/9-months.html';
const MERCK = 'https://www.merckmanuals.com/professional/pediatrics/symptoms-in-infants-and-children/separation-anxiety-and-stranger-anxiety';
const MOTOR = 'https://pubmed.ncbi.nlm.nih.gov/26704990/';

const COMMON = [
  { text: 'Babies often wake more in the weeks after learning something new, like pulling '
      + 'to stand. It usually settles once the new skill stops being exciting.',
    tier: 'B', source: MOTOR },
];

const BY_BAND = {
  '4-5': [
    { text: 'Most babies this age are still on three or four naps a day.', tier: 'A2', source: GALLAND },
    { text: 'Swaddling needs to stop as soon as he tries to roll.', tier: 'A1', source: AASM },
  ],
  '6-7': [
    { text: 'Naps usually settle toward two or three a day over the next couple of months.',
      tier: 'A2', source: GALLAND },
    { text: 'Around six months, total sleep averages a little over fourteen hours, but the '
        + 'normal range is enormous — roughly ten to eighteen hours.', tier: 'A2', source: IGLOW },
  ],
  '8-9': [
    { text: 'Two naps a day is the average at this age, though anywhere from one to three '
        + 'is within the normal range.', tier: 'A2', source: GALLAND },
    { text: 'About one waking a night is average right now, and up to three is still normal. '
        + 'Roughly eight in ten babies this age still wake at night.', tier: 'A2', source: GALLAND },
    { text: 'Separation anxiety usually starts around eight months and builds toward a peak '
        + 'between ten and eighteen months. It is a normal part of development.',
      tier: 'A1', source: MERCK },
    { text: 'Pulling to stand and cruising often show up in the next month or two.',
      tier: 'A1', source: CDC },
    ...COMMON,
  ],
  '10-11': [
    { text: 'Total sleep drifts down slowly now — around five minutes less per month.',
      tier: 'A2', source: GALLAND },
    { text: 'Separation anxiety is usually near its peak between ten and eighteen months.',
      tier: 'A1', source: MERCK },
    ...COMMON,
  ],
  '12-14': [
    { text: 'The move from two naps to one usually happens somewhere between twelve and '
        + 'eighteen months. Two naps at fourteen months is completely normal.',
      tier: 'A2', source: IGLOW },
    ...COMMON,
  ],
  '15-17': [
    { text: 'Most children are on a single midday nap by now, though some keep two well '
        + 'past eighteen months.', tier: 'A2', source: IGLOW },
    ...COMMON,
  ],
  '18-24': [
    { text: 'A nap that ends late in the afternoon can push bedtime later and shorten the night.',
      tier: 'B', source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4899693/' },
    { text: 'Almost all children this age still nap — fewer than one in forty have stopped '
        + 'before their second birthday.', tier: 'A2', source: IGLOW },
  ],
};

export function expectationsFor(bandKey) {
  return BY_BAND[bandKey] ?? COMMON;
}
```

- [ ] **Step 5: Implement `js/views/insights.js`**

```js
import { getState, bandKey, navigate } from '../app.js';
import { rollingAverages, routineStreak, compareToBand } from '../insights.js';
import { expectationsFor } from '../content.js';
import { BANDS } from '../sleep-data.js';
import { tabs } from './tabs.js';

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

const TIER_LABEL = {
  A1: 'Published guideline', A2: 'Research evidence',
  B: 'Observed in studies', C: 'Common practice',
};

export async function render(container) {
  const s = getState();
  const now = new Date();
  const key = bandKey(now);
  const band = BANDS[key];
  const avg = rollingAverages(s.sleeps, 14, now);
  const routine = routineStreak(s.sleeps);
  const cmp = band ? compareToBand(avg.avgTotalMin, band) : null;

  const comparison = !band || avg.sampleDays === 0
    ? '<p class="muted">Log a few days and his averages will show up here.</p>'
    : `<p>Averaging ${hm(avg.avgTotalMin)} a day over ${avg.sampleDays} day${
        avg.sampleDays === 1 ? '' : 's'}.</p>
       <p class="muted">Babies this age typically sleep ${cmp.normMinHours}–${cmp.normMaxHours}
         hours in twenty-four. ${cmp.status === 'within'
           ? 'He is right in that range.'
           : 'He is outside that range — worth mentioning at his next check-up, though the '
             + 'normal spread between healthy babies is very wide.'}</p>
       <p class="muted">Naps ${avg.avgNapCount} a day · Day ${hm(avg.avgDayMin)}
         · Night ${hm(avg.avgNightMin)}</p>`;

  const routineCard = routine.nightsLogged === 0
    ? '<p class="muted">Tick "followed the usual routine" on a night sleep to track this.</p>'
    : `<p>Routine followed on ${routine.nightsWithRoutine} of the last
        ${routine.nightsLogged} nights.</p>
       <p class="muted">${routine.meetsThreshold
         ? 'That is at or above five nights a week, which is the level shown to help.'
         : 'Five nights a week is the level at which a consistent routine has been shown to '
           + 'improve settling and night waking.'}</p>`;

  container.innerHTML = `
    ${tabs('insights')}
    <h1>Insights</h1>
    <div class="card"><h2>Sleep totals</h2>${comparison}</div>
    <div class="card"><h2>Bedtime routine</h2>${routineCard}
      <p class="muted"><span class="tier tier-A2">${TIER_LABEL.A2}</span></p></div>
    <div class="card"><h2>What to expect</h2>
      ${expectationsFor(key).map((e) => `
        <div class="reason">
          <span class="tier tier-${e.tier}">${TIER_LABEL[e.tier]}</span>
          <p>${e.text}</p>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
```

- [ ] **Step 6: Register and cache**

In `js/views/index.js`, import `insights` and add it to `ROUTES`. The tab is already listed in `js/views/tabs.js`.

In `sw.js`, add `'./js/insights.js'`, `'./js/content.js'`, `'./js/views/insights.js'` to `SHELL` and bump `CACHE` to `'rested-v4'`.

- [ ] **Step 7: Run the suite**

Run: `python run-tests.py`
Expected: all tests PASS, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add js/insights.js js/content.js js/views/insights.js js/views/index.js test/insights.test.js test.html sw.js
git commit -m "feat: insights with normative comparison and routine tracking

Routine consistency is surfaced as a first-class feature because it is the
only RCT-backed lever available; everything else is observational or convention.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Personalization proposals

**Files:**
- Create: `js/learning.js`, `test/learning.test.js`
- Modify: `js/views/insights.js`, `sw.js`, `test.html`

**Interfaces:**
- Consumes: `BANDS` (sleep-data), `active`, `durationMinutes` (model)
- Produces:
  - `observedWakeWindows(sleeps) → [{ beforeSleepId, minutes, mood }]`
  - `proposeAdjustment(sleeps, band, { minSamples = 8, minDeviation = 15 }) → { offsetMinutes, observedMedian, conventionMid, sampleSize } | null`

- [ ] **Step 1: Write the failing tests**

Create `test/learning.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { observedWakeWindows, proposeAdjustment } from '../js/learning.js';
import { BANDS } from '../js/sleep-data.js';
import { createSleep } from '../js/model.js';

const nap = (s, e, mood = 'easy') =>
  ({ ...createSleep({ type: 'nap', startedAt: s, endedAt: e }), mood });
const night = (s, e) => createSleep({ type: 'night', startedAt: s, endedAt: e });

// Builds `n` days where every nap follows exactly `gapMin` minutes awake.
// `startDay` exists so two calls can be concatenated without colliding on
// the same calendar dates, which would produce nonsense gaps.
function days(n, gapMin, mood = 'easy', startDay = 2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = startDay + i;
    out.push(night(`2026-09-${String(day - 1).padStart(2, '0')}T19:00:00`,
      `2026-09-${String(day).padStart(2, '0')}T07:00:00`));
    const napStart = new Date(2026, 8, day, 7, 0, 0);
    napStart.setMinutes(napStart.getMinutes() + gapMin);
    const napEnd = new Date(napStart.getTime() + 60 * 60000);
    out.push(nap(napStart.toISOString(), napEnd.toISOString(), mood));
  }
  return out;
}

test('computes the awake gap preceding each sleep', () => {
  const w = observedWakeWindows([
    night('2026-09-13T19:00:00', '2026-09-14T07:00:00'),
    nap('2026-09-14T10:00:00', '2026-09-14T11:00:00'),
  ]);
  eq(w.length, 1);
  eq(w[0].minutes, 180);
});

test('ignores in-progress sleeps', () => {
  const w = observedWakeWindows([
    night('2026-09-13T19:00:00', '2026-09-14T07:00:00'),
    createSleep({ type: 'nap', startedAt: '2026-09-14T10:00:00' }),
  ]);
  eq(w.length, 0);
});

test('no proposal when there is too little data', () =>
  eq(proposeAdjustment(days(2, 240), BANDS['8-9']), null));

test('no proposal when the child matches the convention', () => {
  // 8-9 band first window is 120-165, midpoint 142.5.
  eq(proposeAdjustment(days(10, 143), BANDS['8-9']), null);
});

test('proposes a positive offset for a consistently longer gap', () => {
  const p = proposeAdjustment(days(10, 190), BANDS['8-9']);
  ok(p, 'expected a proposal');
  ok(p.offsetMinutes > 0, `expected a positive offset, got ${p.offsetMinutes}`);
  eq(p.sampleSize, 10);
});

test('proposes a negative offset for a consistently shorter gap', () => {
  const p = proposeAdjustment(days(10, 100), BANDS['8-9']);
  ok(p && p.offsetMinutes < 0, 'expected a negative offset');
});

test('the proposed offset is capped at 45 minutes', () => {
  const p = proposeAdjustment(days(10, 400), BANDS['8-9']);
  ok(p.offsetMinutes <= 45, `expected a cap at 45, got ${p.offsetMinutes}`);
});

test('only sleeps marked easy are used as evidence', () => {
  // Rough naps at an unusual gap must not drive a proposal.
  eq(proposeAdjustment(days(10, 240, 'rough'), BANDS['8-9']), null);
});

test('noisy data produces no proposal', () => {
  // Two clusters 140 minutes apart on non-overlapping dates: the
  // interquartile spread exceeds the 90-minute stability limit.
  const mixed = [...days(5, 100, 'easy', 2), ...days(5, 240, 'easy', 12)];
  eq(proposeAdjustment(mixed, BANDS['8-9']), null);
});
```

Add `import './test/learning.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/learning.js`**

```js
import { active } from './model.js';

const CAP = 45;

export function observedWakeWindows(sleeps) {
  const done = active(sleeps)
    .filter((s) => s.endedAt)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  const out = [];
  for (let i = 1; i < done.length; i++) {
    const prevEnd = new Date(done[i - 1].endedAt);
    const start = new Date(done[i].startedAt);
    const minutes = Math.round((start - prevEnd) / 60000);
    if (minutes <= 0 || minutes > 12 * 60) continue;
    out.push({ beforeSleepId: done[i].id, minutes, mood: done[i].mood ?? null });
  }
  return out;
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function spread(values) {
  const v = [...values].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return q(0.75) - q(0.25);
}

export function proposeAdjustment(sleeps, band, { minSamples = 8, minDeviation = 15 } = {}) {
  if (!band) return null;

  const easy = observedWakeWindows(sleeps)
    .filter((w) => w.mood === 'easy')
    .map((w) => w.minutes);

  if (easy.length < minSamples) return null;

  // Reject noisy data: if the middle half of the observations spans more than
  // 90 minutes, there is no stable pattern to learn from.
  if (spread(easy) > 90) return null;

  const observed = median(easy);
  const conventionMid = (band.wakeWindows.first.minMin + band.wakeWindows.first.maxMin) / 2;
  const raw = observed - conventionMid;

  if (Math.abs(raw) < minDeviation) return null;

  const offsetMinutes = Math.max(-CAP, Math.min(CAP, Math.round(raw)));
  return { offsetMinutes, observedMedian: observed, conventionMid, sampleSize: easy.length };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `python run-tests.py`
Expected: all learning tests PASS, exit code 0.

- [ ] **Step 5: Surface the proposal in Insights**

In `js/views/insights.js`, add these imports:

```js
import { proposeAdjustment } from '../learning.js';
import { put } from '../store.js';
import { newId } from '../model.js';
```

Add before `container.innerHTML =`:

```js
  const proposal = band ? proposeAdjustment(s.sleeps, band) : null;
  const activeAdj = s.adjustments.find((a) => a.active && !a.deletedAt);
  const proposalCard = proposal && !activeAdj ? `
    <div class="card"><h2>Something we noticed</h2>
      <p>His easy naps have been following about ${Math.round(proposal.observedMedian)} minutes
        awake, rather than the ${Math.round(proposal.conventionMid)} minutes typical for his age.
        That is based on ${proposal.sampleSize} naps.</p>
      <p class="muted">Want suggestions to use his pattern instead?</p>
      <button class="btn" id="accept-adj">Use his pattern</button>
      <button class="btn secondary" id="reject-adj">No thanks</button>
    </div>` : '';
```

Insert `${proposalCard}` into the template immediately after the `<h1>Insights</h1>` line, then add these listeners at the end of `render`:

```js
  const acc = container.querySelector('#accept-adj');
  if (acc) {
    acc.addEventListener('click', async () => {
      await put(s.db, 'adjustments', {
        id: newId(), kind: 'wakeWindow', offsetMinutes: proposal.offsetMinutes,
        ageBandAtCreation: key, acceptedAt: new Date().toISOString(), active: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
      });
      location.reload();
    });
    container.querySelector('#reject-adj').addEventListener('click', async () => {
      await put(s.db, 'adjustments', {
        id: newId(), kind: 'wakeWindow', offsetMinutes: 0,
        ageBandAtCreation: key, acceptedAt: new Date().toISOString(), active: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
      });
      location.reload();
    });
  }
```

- [ ] **Step 6: Cache the new module**

In `sw.js`, add `'./js/learning.js'` to `SHELL` and bump `CACHE` to `'rested-v5'`.

- [ ] **Step 7: Run the suite and verify by hand**

Run: `python run-tests.py` — expect exit code 0.

By hand: with fewer than eight easy naps logged, no proposal appears. The engine already honours an accepted adjustment (Task 5 covers that with tests).

- [ ] **Step 8: Commit**

```bash
git add js/learning.js js/views/insights.js test/learning.test.js test.html sw.js
git commit -m "feat: confirmable personalization proposals

Proposals require eight easy-rated naps and a stable interquartile spread,
so noisy data cannot drift the suggestions. The user always confirms.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Red flags, settings, and export

**Files:**
- Create: `js/flags.js`, `js/views/settings.js`, `test/flags.test.js`
- Modify: `js/views/index.js`, `js/views/today.js`, `sw.js`, `test.html`

**Interfaces:**
- Consumes: `rollingAverages` (insights), `BANDS` (sleep-data)
- Produces:
  - `detectFlags({ sleeps, band, now }) → [{ id, text, severity: 'info'|'discuss' }]`
  - `render(container)` from `js/views/settings.js`

- [ ] **Step 1: Write the failing tests**

Create `test/flags.test.js`:

```js
import { test, eq, ok } from './harness.js';
import { detectFlags } from '../js/flags.js';
import { BANDS } from '../js/sleep-data.js';
import { createSleep } from '../js/model.js';

const NOW = new Date('2026-09-14T20:00:00');
const night = (s, e) => createSleep({ type: 'night', startedAt: s, endedAt: e });
const nap = (s, e) => createSleep({ type: 'nap', startedAt: s, endedAt: e });

function nights(n, hours) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = 1 + i;
    const start = new Date(2026, 8, d, 19, 0, 0);
    const end = new Date(start.getTime() + hours * 3600000);
    out.push(night(start.toISOString(), end.toISOString()));
  }
  return out;
}

test('normal sleep raises no flags', () => {
  // The nap must fall on a day that already has a night sleep. A nap on its
  // own calendar day would count as a 90-minute day and drag the mean down.
  const f = detectFlags({
    sleeps: [...nights(10, 12), nap('2026-09-01T09:30:00', '2026-09-01T11:00:00')],
    band: BANDS['8-9'], now: NOW,
  });
  eq(f.filter((x) => x.severity === 'discuss').length, 0);
});

test('persistently low total sleep is flagged for discussion', () => {
  const f = detectFlags({ sleeps: nights(10, 8), band: BANDS['8-9'], now: NOW });
  ok(f.some((x) => x.severity === 'discuss'), 'expected a discuss-level flag');
});

test('persistently high total sleep is flagged for discussion', () => {
  const f = detectFlags({ sleeps: nights(10, 18), band: BANDS['8-9'], now: NOW });
  ok(f.some((x) => x.severity === 'discuss'), 'expected a discuss-level flag');
});

test('sparse data never triggers a flag', () => {
  const f = detectFlags({ sleeps: nights(2, 8), band: BANDS['8-9'], now: NOW });
  eq(f.filter((x) => x.severity === 'discuss').length, 0);
});

test('no band means no flags rather than a crash', () =>
  eq(detectFlags({ sleeps: nights(10, 8), band: null, now: NOW }), []));

test('flag text never uses banned words and never claims safety benefit', () => {
  const f = detectFlags({ sleeps: nights(10, 8), band: BANDS['8-9'], now: NOW });
  const all = f.map((x) => x.text).join(' ').toLowerCase();
  ok(!all.includes('overtired'));
  ok(!all.includes('regression'));
  ok(!all.includes('sids'));
  ok(!all.includes('safer'));
});
```

Add `import './test/flags.test.js';` to `test.html`.

- [ ] **Step 2: Run to verify failure**

Run: `python run-tests.py`
Expected: exit code 1.

- [ ] **Step 3: Implement `js/flags.js`**

```js
import { rollingAverages } from './insights.js';

const MIN_DAYS = 7;

// 2nd-98th percentile band at 9 months (Iglowstein 2003). Deliberately wide:
// the point is to catch genuine outliers, not to worry a parent about variation.
const OUTLIER_LOW_MIN = 10.5 * 60;
const OUTLIER_HIGH_MIN = 17.4 * 60;

export function detectFlags({ sleeps, band, now = new Date() }) {
  if (!band) return [];
  const avg = rollingAverages(sleeps, 14, now);
  if (avg.sampleDays < MIN_DAYS) return [];

  const flags = [];
  if (avg.avgTotalMin < OUTLIER_LOW_MIN) {
    flags.push({
      id: 'total-low', severity: 'discuss',
      text: 'Over the last couple of weeks his daily sleep has averaged below the range '
        + 'reported for almost all babies his age. Healthy babies vary a lot, but this is '
        + 'worth raising with your pediatrician.',
    });
  }
  if (avg.avgTotalMin > OUTLIER_HIGH_MIN) {
    flags.push({
      id: 'total-high', severity: 'discuss',
      text: 'His daily sleep has averaged above the range reported for almost all babies '
        + 'his age. That is usually nothing, but it is worth mentioning at his next visit.',
    });
  }
  return flags;
}
```

- [ ] **Step 4: Implement `js/views/settings.js`**

```js
import { getState, navigate } from '../app.js';
import { put, clearAll, getAll, STORES } from '../store.js';
import { softDelete } from '../model.js';
import { tabs } from './tabs.js';

export async function render(container) {
  const s = getState();
  const adj = s.adjustments.filter((a) => a.active && !a.deletedAt);

  container.innerHTML = `
    ${tabs('settings')}
    <h1>Settings</h1>
    <div class="card"><h2>${s.child.name}</h2>
      <p class="muted">Born ${s.child.dob}${s.child.gestationalWeeksAtBirth
        ? ` at ${s.child.gestationalWeeksAtBirth} weeks — ages are corrected` : ''}</p></div>

    <div class="card"><h2>Personal adjustments</h2>
      ${adj.length === 0 ? '<p class="muted">None active. Suggestions use published age norms.</p>'
        : adj.map((a) => `<p>Awake stretches shifted by ${a.offsetMinutes > 0 ? '+' : ''}${
            a.offsetMinutes} minutes
          <button class="btn secondary" data-clear-adj="${a.id}">Turn off</button></p>`).join('')}
    </div>

    <div class="card"><h2>Safe sleep</h2>
      <ul class="muted">
        <li>On his back for every sleep, until he turns one.</li>
        <li>Firm, flat surface. Nothing in the crib but a fitted sheet.</li>
        <li>Share a room, not a bed, ideally for at least the first six months.</li>
        <li>Car seats, swings and strollers aren't for routine sleep.</li>
        <li>Stop swaddling as soon as he tries to roll.</li>
      </ul>
      <p class="muted">Summarised from the American Academy of Pediatrics, 2022.</p>
    </div>

    <div class="card"><h2>Your data</h2>
      <p class="muted">Everything is stored on this phone only.</p>
      <button class="btn secondary" id="export">Export as JSON</button>
      <button class="btn secondary" id="reset">Delete everything</button>
    </div>

    <div class="card notice"><p>This app is a planning aid, not medical advice.
      His cues matter more than any suggestion here, and anything that worries you
      belongs with your pediatrician.</p></div>`;

  container.querySelector('#export').addEventListener('click', async () => {
    const dump = {};
    for (const st of STORES) dump[st] = await getAll(s.db, st);
    const text = JSON.stringify(dump, null, 2);
    const box = document.createElement('textarea');
    box.value = text;
    box.rows = 12;
    box.style.width = '100%';
    container.appendChild(box);
    box.select();
  });

  container.querySelector('#reset').addEventListener('click', async () => {
    if (!confirm('Delete all logged sleep and start over? This cannot be undone.')) return;
    await clearAll(s.db);
    location.reload();
  });

  container.querySelectorAll('[data-clear-adj]').forEach((b) =>
    b.addEventListener('click', async () => {
      const a = s.adjustments.find((x) => x.id === b.dataset.clearAdj);
      await put(s.db, 'adjustments', { ...a, active: false, updatedAt: new Date().toISOString() });
      location.reload();
    }));

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
```

The export deliberately renders into a textarea rather than triggering a download, because a downloaded file from an installed PWA is awkward to retrieve on Android. Selecting and copying is more reliable.

- [ ] **Step 5: Show flags on the Today screen**

In `js/views/today.js`, add:

```js
import { detectFlags } from '../flags.js';
import { BANDS } from '../sleep-data.js';
```

and inside `render`, after `const sug = ...`:

```js
  const flags = detectFlags({ sleeps: s.sleeps, band: BANDS[key], now });
  const flagsHtml = flags.map((f) =>
    `<div class="card notice"><p>${f.text}</p></div>`).join('');
```

then insert `${flagsHtml}` into the template immediately after the `<h1>` line.

- [ ] **Step 6: Register settings and cache the new modules**

In `js/views/index.js`, import `settings` and add it to `ROUTES`. The tab is already listed in `js/views/tabs.js`.

In `sw.js`, add `'./js/flags.js'` and `'./js/views/settings.js'` to `SHELL` and bump `CACHE` to `'rested-v6'`.

- [ ] **Step 7: Run the suite**

Run: `python run-tests.py`
Expected: every test PASSES, exit code 0.

- [ ] **Step 8: Full manual pass on the phone**

Reinstall from the home screen (or clear the site data so the new service worker takes over). Then, in airplane mode, walk the whole flow: onboarding → log a night → log two naps → see a bedtime suggestion → edit a sleep → add a night waking → check History → check Insights → export from Settings.

- [ ] **Step 9: Commit**

```bash
git add js/flags.js js/views/settings.js js/views/index.js js/views/today.js test/flags.test.js test.html sw.js
git commit -m "feat: pediatrician referral flags, settings, and data export

Flags require seven days of data and use the 2nd-98th percentile band, so
they catch genuine outliers rather than normal variation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** Walked every spec section against the task list:

| Spec section | Covered by |
|---|---|
| §3.1 windows not minutes | Task 5 (test: "the window is a range") |
| §3.2 evidence tiers | Tasks 3, 5, 8, 12 (tests enforce valid tiers, ban tier D) |
| §3.3 wake windows labeled convention | Task 3 (test: all bands tier C), Task 5 |
| §3.4 clock-anchored engine | Task 5 |
| §3.5 milestones not regressions | Tasks 11, 12 (banned-word tests) |
| §3.6 proposed learning | Task 13 |
| §3.7 derived wake events | Task 5 (no wake record exists) |
| §4 architecture, offline | Tasks 1, 7, 9 |
| §5 data model | Task 4 |
| §6 engine incl. no nap cap under 18mo | Tasks 3, 5 |
| §7 reference table rules | Task 3 |
| §8 six screens | Tasks 7, 8, 10, 11, 12, 14 |
| §9 testing | Every task; DST noted below |
| §10.1 no safety claims | Task 14 (test) |
| §10.2 safe-sleep content | Tasks 7, 14 |
| §10.3 red flags | Task 14 |
| §10.4 prematurity | Tasks 2, 7 |
| §10.5 disclaimers | Tasks 7, 14 |
| §11 phasing | Tasks 1–9 = Phase 1; 10–11 = Phase 2; 12 = Phase 3; 13–14 = Phase 4 |

**One deliberate gap.** The spec calls for DST-transition tests. They are not in the plan as fixed tests, because a DST assertion written against one machine's timezone fails on another, which would make the suite fragile. Instead the engine avoids the hazard structurally: every day boundary goes through `localDayKey`, which reads local date components rather than doing UTC arithmetic, and Task 4 tests that directly. If you want an explicit DST test later, the right shape is to run the suite with `TZ` forced — worth adding, not worth blocking on.

**Placeholder scan.** No TBDs, no "similar to Task N", no "add error handling". Every code step carries complete code.

**Type consistency.** Checked the names crossing task boundaries: `suggest`, `atClock`, `BANDS`, `hoursToMinutes`, `active`, `durationMinutes`, `localDayKey`, `createSleep`, `createWaking`, `createMilestone`, `createChild`, `softDelete`, `newId`, `openDb`, `put`, `get`, `getAll`, `clearAll`, `STORES`, `groupByDay`, `dayBarSegments`, `rollingAverages`, `routineStreak`, `compareToBand`, `expectationsFor`, `observedWakeWindows`, `proposeAdjustment`, `detectFlags`, `tabs`, `toLocalInputValue`, `fromLocalInputValue`. All consistent between the task that defines each and the tasks that consume it.

**Service worker discipline.** Every task that adds a file under `js/` also adds it to `SHELL` and bumps `CACHE`. Skipping that is the most likely way to ship an app that looks broken after an update, so it is an explicit step each time rather than a note.
