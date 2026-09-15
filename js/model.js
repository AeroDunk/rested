const SLEEP_TYPES = ['nap', 'night'];
export const MILESTONE_KINDS = [
  'sitting', 'crawling', 'pullingToStand', 'cruising', 'walking', 'other',
];

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function stamps() {
  const iso = new Date().toISOString();
  return { createdAt: iso, updatedAt: iso, deletedAt: null };
}

export function createChild({ name, dob, gestationalWeeksAtBirth = null }) {
  if (!name) throw new Error('child name is required');
  if (!dob) throw new Error('child dob is required');
  return { id: newId(), name, dob, gestationalWeeksAtBirth, ...stamps() };
}

export function createSleep({
  type, startedAt, endedAt = null, note = null, mood = null, routineFollowed = null,
}) {
  if (!SLEEP_TYPES.includes(type)) throw new Error(`unknown sleep type: ${type}`);
  if (!startedAt) throw new Error('startedAt is required');
  return { id: newId(), type, startedAt, endedAt, note, mood, routineFollowed, ...stamps() };
}

export function createWaking({ sleepId, wokeAt, backAsleepAt = null, note = null }) {
  if (!sleepId) throw new Error('sleepId is required');
  if (!wokeAt) throw new Error('wokeAt is required');
  return { id: newId(), sleepId, wokeAt, backAsleepAt, note, ...stamps() };
}

export function createMilestone({ kind, observedAt, note = null }) {
  if (!MILESTONE_KINDS.includes(kind)) throw new Error(`unknown milestone kind: ${kind}`);
  if (!observedAt) throw new Error('observedAt is required');
  return { id: newId(), kind, observedAt, note, ...stamps() };
}

export function softDelete(record, now = new Date()) {
  const iso = now.toISOString();
  return { ...record, deletedAt: iso, updatedAt: iso };
}

export function active(records) {
  return records.filter((r) => !r.deletedAt);
}

export function durationMinutes(sleep) {
  if (!sleep.endedAt) return null;
  return Math.round((new Date(sleep.endedAt) - new Date(sleep.startedAt)) / 60000);
}

export function localDayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
