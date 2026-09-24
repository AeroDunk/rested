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
  // A skipped-nap marker has no endedAt but is not "in progress" — it's a
  // deliberate placeholder saying that nap slot was skipped.
  const open = all.find((s) => !s.endedAt && !s.skipped);
  if (open) {
    return {
      kind: 'in-progress', windowStart: null, windowEnd: null, targetDuration: null,
      predictedWake: null, reasons: [], confidence: 'normal', napIndex: 0, sleep: open,
    };
  }

  const done = [...all].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  const lastNight = [...done].reverse().find((s) => s.type === 'night');
  // Skip skipped-nap markers when finding the last completed sleep boundary —
  // they have no end time and would break wake-window arithmetic.
  const lastCompleted = [...done].reverse().find((s) => s.endedAt);
  const wakeTime = lastNight ? new Date(lastNight.endedAt) : null;
  const lastEnd = lastCompleted ? new Date(lastCompleted.endedAt) : null;

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
