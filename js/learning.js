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
