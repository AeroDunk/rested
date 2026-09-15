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
