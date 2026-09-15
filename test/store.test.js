import { test, eq, ok } from './harness.js';
import { openDb, put, get, getAll, clearAll, STORES } from '../js/store.js';
import { createSleep, softDelete } from '../js/model.js';
import { active } from '../js/model.js';

let n = 0;
const freshDb = () => openDb('sleeptest-' + Date.now() + '-' + n++);

test('opens a database with every expected store', async () => {
  const db = await freshDb();
  for (const s of STORES) ok(db.objectStoreNames.contains(s), `missing store ${s}`);
  db.close();
});

test('round-trips a record', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', s);
  const back = await get(db, 'sleeps', s.id);
  eq(back.id, s.id);
  eq(back.type, 'nap');
  db.close();
});

test('getAll returns every stored record', async () => {
  const db = await freshDb();
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' }));
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T14:00:00' }));
  eq((await getAll(db, 'sleeps')).length, 2);
  db.close();
});

test('put overwrites a record with the same id', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', s);
  await put(db, 'sleeps', { ...s, endedAt: '2026-09-14T10:45:00' });
  const all = await getAll(db, 'sleeps');
  eq(all.length, 1);
  eq(all[0].endedAt, '2026-09-14T10:45:00');
  db.close();
});

test('soft-deleted records persist but are excluded by active()', async () => {
  const db = await freshDb();
  const s = createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' });
  await put(db, 'sleeps', softDelete(s, new Date()));
  const all = await getAll(db, 'sleeps');
  eq(all.length, 1);
  eq(active(all).length, 0);
  db.close();
});

test('clearAll empties every store', async () => {
  const db = await freshDb();
  await put(db, 'sleeps', createSleep({ type: 'nap', startedAt: '2026-09-14T09:30:00' }));
  await clearAll(db);
  eq((await getAll(db, 'sleeps')).length, 0);
  db.close();
});

test('get returns undefined for a missing id', async () => {
  const db = await freshDb();
  eq(await get(db, 'sleeps', 'nope'), undefined);
  db.close();
});
