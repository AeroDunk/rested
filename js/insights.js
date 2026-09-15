import { groupByDay } from './history-data.js';
import { active } from './model.js';

const ROUTINE_THRESHOLD = 5 / 7;

export function rollingAverages(sleeps, days = 14, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const recent = active(sleeps).filter((s) => new Date(s.startedAt) >= cutoff);
  const grouped = groupByDay(recent, []);

  if (grouped.length === 0) {
    return { avgTotalMin: 0, avgDayMin: 0, avgNightMin: 0, avgNapCount: 0, sampleDays: 0 };
  }
  const sum = (f) => grouped.reduce((a, d) => a + f(d), 0);
  const n = grouped.length;
  return {
    avgTotalMin: Math.round(sum((d) => d.totalMin) / n),
    avgDayMin: Math.round(sum((d) => d.dayMin) / n),
    avgNightMin: Math.round(sum((d) => d.nightMin) / n),
    avgNapCount: Math.round((sum((d) => d.sleeps.filter((s) => s.type === 'nap').length) / n) * 10) / 10,
    sampleDays: n,
  };
}

export function routineStreak(sleeps, weeks = 2) {
  const nights = active(sleeps)
    .filter((s) => s.type === 'night' && s.routineFollowed !== null)
    .slice(-weeks * 7);
  const withRoutine = nights.filter((s) => s.routineFollowed === true).length;
  return {
    nightsWithRoutine: withRoutine,
    nightsLogged: nights.length,
    meetsThreshold: nights.length > 0 && withRoutine / nights.length >= ROUTINE_THRESHOLD,
  };
}

export function compareToBand(avgTotalMin, band) {
  const lo = band.total24h.minHours * 60;
  const hi = band.total24h.maxHours * 60;
  let status = 'within';
  if (avgTotalMin < lo) status = 'below';
  if (avgTotalMin > hi) status = 'above';
  return { status, normMinHours: band.total24h.minHours, normMaxHours: band.total24h.maxHours };
}
