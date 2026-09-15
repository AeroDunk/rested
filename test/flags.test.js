import { test, eq, ok } from './harness.js';
import { detectFlags } from '../js/flags.js';
import { BANDS } from '../js/sleep-data.js';
import { createSleep } from '../js/model.js';

const NOW = new Date('2026-09-14T20:00:00');
const night = (s, e) => createSleep({ type: 'night', startedAt: s, endedAt: e });
const nap = (s, e) => createSleep({ type: 'nap', startedAt: s, endedAt: e });

function nights(n, hours) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = 1 + i;
    const start = new Date(2026, 8, d, 19, 0, 0);
    const end = new Date(start.getTime() + hours * 3600000);
    out.push(night(start.toISOString(), end.toISOString()));
  }
  return out;
}

test('normal sleep raises no flags', () => {
  // The nap must fall on a day that already has a night sleep. A nap on its
  // own calendar day would count as a 90-minute day and drag the mean down.
  const f = detectFlags({
    sleeps: [...nights(10, 12), nap('2026-09-01T09:30:00', '2026-09-01T11:00:00')],
    band: BANDS['8-9'], now: NOW,
  });
  eq(f.filter((x) => x.severity === 'discuss').length, 0);
});

test('persistently low total sleep is flagged for discussion', () => {
  const f = detectFlags({ sleeps: nights(10, 8), band: BANDS['8-9'], now: NOW });
  ok(f.some((x) => x.severity === 'discuss'), 'expected a discuss-level flag');
});

test('persistently high total sleep is flagged for discussion', () => {
  const f = detectFlags({ sleeps: nights(10, 18), band: BANDS['8-9'], now: NOW });
  ok(f.some((x) => x.severity === 'discuss'), 'expected a discuss-level flag');
});

test('sparse data never triggers a flag', () => {
  const f = detectFlags({ sleeps: nights(2, 8), band: BANDS['8-9'], now: NOW });
  eq(f.filter((x) => x.severity === 'discuss').length, 0);
});

test('no band means no flags rather than a crash', () =>
  eq(detectFlags({ sleeps: nights(10, 8), band: null, now: NOW }), []));

test('flag text never uses banned words and never claims safety benefit', () => {
  const f = detectFlags({ sleeps: nights(10, 8), band: BANDS['8-9'], now: NOW });
  const all = f.map((x) => x.text).join(' ').toLowerCase();
  ok(!all.includes('overtired'));
  ok(!all.includes('regression'));
  ok(!all.includes('sids'));
  ok(!all.includes('safer'));
});

test('every flag carries a tier and a source, like other evidentiary claims', () => {
  const low = detectFlags({ sleeps: nights(10, 8), band: BANDS['8-9'], now: NOW });
  const high = detectFlags({ sleeps: nights(10, 18), band: BANDS['8-9'], now: NOW });
  for (const f of [...low, ...high]) {
    ok(!!f.tier, `expected a tier on flag ${f.id}`);
    ok(!!f.source, `expected a source on flag ${f.id}`);
  }
});
