import { test, eq } from './harness.js';
import { formatTime, toLocalInputValue, fromLocalInputValue } from '../js/format.js';

test('formatTime renders morning as AM with no leading zero on hour', () =>
  eq(formatTime(new Date(2026, 8, 14, 9, 5)), '9:05 AM'));

test('formatTime renders afternoon as PM with 12-hour clock', () =>
  eq(formatTime(new Date(2026, 8, 14, 14, 30)), '2:30 PM'));

test('formatTime renders midnight as 12:00 AM', () =>
  eq(formatTime(new Date(2026, 8, 14, 0, 0)), '12:00 AM'));

test('formatTime renders noon as 12:00 PM', () =>
  eq(formatTime(new Date(2026, 8, 14, 12, 0)), '12:00 PM'));

test('formatTime pads the minutes to two digits', () =>
  eq(formatTime(new Date(2026, 8, 14, 7, 3)), '7:03 AM'));

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
