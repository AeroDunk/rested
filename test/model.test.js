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
