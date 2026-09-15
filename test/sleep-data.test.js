import { test, eq, ok } from './harness.js';
import { BANDS, TIERS, hoursToMinutes } from '../js/sleep-data.js';
import { BAND_KEYS } from '../js/age.js';

test('every age band has an entry', () =>
  eq(Object.keys(BANDS).sort(), [...BAND_KEYS].sort()));

test('every numeric field carries a tier and a source URL', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    for (const field of ['total24h', 'nightInBed', 'dayTotal', 'napCount', 'wakeWindows']) {
      const v = b[field];
      ok(v, `${key}.${field} missing`);
      ok(TIERS.includes(v.tier), `${key}.${field} has invalid tier ${v.tier}`);
      ok(typeof v.source === 'string' && v.source.startsWith('http'),
        `${key}.${field} missing source URL`);
    }
  }
});

test('tier D never appears', () => {
  const json = JSON.stringify(BANDS);
  ok(!json.includes('"tier":"D"'), 'tier D is banned from the data table');
});

test('all ranges have min <= max', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    for (const f of ['total24h', 'nightInBed', 'dayTotal']) {
      ok(b[f].minHours <= b[f].maxHours, `${key}.${f} inverted`);
    }
    for (const w of ['first', 'middle', 'last']) {
      ok(b.wakeWindows[w].minMin <= b.wakeWindows[w].maxMin, `${key}.${w} inverted`);
    }
  }
});

test('day plus night is consistent with the 24h total', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    const lo = b.nightInBed.minHours + b.dayTotal.minHours;
    const hi = b.nightInBed.maxHours + b.dayTotal.maxHours;
    ok(hi >= b.total24h.minHours, `${key}: day+night max below total min`);
    ok(lo <= b.total24h.maxHours, `${key}: day+night min above total max`);
  }
});

test('the last wake window is never shorter than the first', () => {
  for (const [key, b] of Object.entries(BANDS)) {
    ok(b.wakeWindows.last.minMin >= b.wakeWindows.first.minMin, `${key} violates it`);
  }
});

test('no nap cap below 18 months', () => {
  for (const key of ['4-5', '6-7', '8-9', '10-11', '12-14', '15-17']) {
    eq(BANDS[key].napCapMinutes, null);
  }
});

test('8-9 month band carries the observed nap clock anchors', () => {
  eq(BANDS['8-9'].napAnchors.times, ['09:30', '14:00']);
  eq(BANDS['8-9'].napAnchors.tier, 'B');
});

test('bands with no observed anchor data say so explicitly', () => {
  eq(BANDS['4-5'].napAnchors, null);
  eq(BANDS['6-7'].napAnchors, null);
});

test('wake windows are always labeled convention', () => {
  for (const b of Object.values(BANDS)) eq(b.wakeWindows.tier, 'C');
});

test('total sleep targets match AASM bands', () => {
  eq([BANDS['8-9'].total24h.minHours, BANDS['8-9'].total24h.maxHours], [12, 16]);
  eq([BANDS['18-24'].total24h.minHours, BANDS['18-24'].total24h.maxHours], [11, 14]);
});

test('hoursToMinutes converts correctly', () => eq(hoursToMinutes(2.5), 150));
