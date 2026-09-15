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
