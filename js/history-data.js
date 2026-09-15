import { active, durationMinutes, localDayKey } from './model.js';

export function groupByDay(sleeps, milestones) {
  const days = new Map();
  const touch = (key) => {
    if (!days.has(key)) {
      days.set(key, { dayKey: key, sleeps: [], milestones: [], nightMin: 0, dayMin: 0, totalMin: 0 });
    }
    return days.get(key);
  };

  for (const s of active(sleeps)) {
    const key = localDayKey(new Date(s.startedAt));
    const d = touch(key);
    d.sleeps.push(s);
    const mins = durationMinutes(s) ?? 0;
    if (s.type === 'night') d.nightMin += mins; else d.dayMin += mins;
    d.totalMin += mins;
  }
  for (const m of active(milestones)) {
    touch(localDayKey(new Date(m.observedAt))).milestones.push(m);
  }

  return [...days.values()].sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

export function dayBarSegments(daySleeps, dayKey) {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const end = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
  const span = end - start;

  return active(daySleeps)
    .filter((s) => s.endedAt)
    .map((s) => {
      const a = Math.max(new Date(s.startedAt), start);
      const b = Math.min(new Date(s.endedAt), end);
      if (b <= a) return null;
      return {
        leftPct: ((a - start) / span) * 100,
        widthPct: ((b - a) / span) * 100,
        type: s.type,
      };
    })
    .filter(Boolean);
}
