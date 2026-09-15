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
