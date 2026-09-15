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
