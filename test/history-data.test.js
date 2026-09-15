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
  // Note: the overnight sleep also gets an end-day entry (for its morning
  // bar segment — see the day-bar test below), so look up the start day by
  // key rather than assuming it is g[0].
  const startDay = g.find((d) => d.dayKey === '2026-09-13');
  ok(startDay, 'expected a start day entry');
  eq(startDay.dayKey, '2026-09-13');
  eq(startDay.nightMin, 720);
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

test('an overnight sleep also appears in the following day\'s bar segments', () => {
  const g = groupByDay([night('2026-09-13T19:00:00', '2026-09-14T07:00:00')], []);
  const startDay = g.find((d) => d.dayKey === '2026-09-13');
  const endDay = g.find((d) => d.dayKey === '2026-09-14');
  ok(startDay, 'expected a start day entry');
  ok(endDay, 'expected an end day entry');
  ok(dayBarSegments(startDay.sleeps, '2026-09-13').length >= 1,
    'start day should render a segment');
  ok(dayBarSegments(endDay.sleeps, '2026-09-14').length >= 1,
    'end day should render the morning portion');
  // Totals stay attributed only to the start day:
  eq(startDay.nightMin, 720);
  eq(endDay.nightMin, 0);
});
