import { test, eq, ok } from './harness.js';
import { suggest, atClock } from '../js/engine.js';
import { createSleep } from '../js/model.js';

const D = (s) => new Date(s);
const night = (start, end) => createSleep({ type: 'night', startedAt: start, endedAt: end });
const nap = (start, end) => createSleep({ type: 'nap', startedAt: start, endedAt: end });
const skippedNap = (start) => createSleep({ type: 'nap', startedAt: start, skipped: true });

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

test('a skipped nap is not treated as in-progress', () => {
  const s = suggest({
    now: D('2026-09-14T11:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      skippedNap('2026-09-14T09:30:00'),
    ],
  });
  ok(s.kind !== 'in-progress', `expected not in-progress, got ${s.kind}`);
});

test('a skipped nap counts toward nap index', () => {
  const s = suggest({
    now: D('2026-09-14T11:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      skippedNap('2026-09-14T09:30:00'),
    ],
  });
  eq(s.napIndex, 1);
  eq(s.kind, 'nap');
});

test('after one real nap and one skipped nap, the next sleep is bedtime', () => {
  const s = suggest({
    now: D('2026-09-14T16:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      nap('2026-09-14T09:30:00', '2026-09-14T10:45:00'),
      skippedNap('2026-09-14T14:00:00'),
    ],
  });
  eq(s.kind, 'bedtime');
});

test('skipped naps do not break wake-window arithmetic for the next suggestion', () => {
  const s = suggest({
    now: D('2026-09-14T11:00:00'), bandKey: '8-9',
    sleeps: [
      night('2026-09-13T19:30:00', '2026-09-14T07:00:00'),
      skippedNap('2026-09-14T09:30:00'),
    ],
  });
  // The wake-window anchor should still work off the previous completed sleep
  // (the night sleep's endedAt), not off the skipped nap which has no endedAt.
  ok(s.windowStart instanceof Date, 'expected a windowStart Date');
  ok(!isNaN(s.windowStart.getTime()), 'expected windowStart to be valid');
});
