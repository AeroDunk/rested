const MS_PER_DAY = 86400000;
const DAYS_PER_MONTH = 30.4375;
const TERM_WEEKS = 40;
const PRETERM_THRESHOLD_WEEKS = 37;

export const BANDS_BOUNDS = [
  { key: '4-5', maxMonths: 6 },
  { key: '6-7', maxMonths: 8 },
  { key: '8-9', maxMonths: 10 },
  { key: '10-11', maxMonths: 12 },
  { key: '12-14', maxMonths: 15 },
  { key: '15-17', maxMonths: 18 },
  { key: '18-24', maxMonths: Infinity },
];

export const BAND_KEYS = BANDS_BOUNDS.map((b) => b.key);

export function correctedAgeDays(dobISO, gestationalWeeksAtBirth, now) {
  const dob = new Date(dobISO + (dobISO.includes('T') ? '' : 'T00:00:00'));
  const raw = Math.floor((now - dob) / MS_PER_DAY);
  if (gestationalWeeksAtBirth == null) return raw;
  if (gestationalWeeksAtBirth >= PRETERM_THRESHOLD_WEEKS) return raw;
  return raw - Math.round((TERM_WEEKS - gestationalWeeksAtBirth) * 7);
}

export function ageMonths(days) {
  return days / DAYS_PER_MONTH;
}

export function bandKeyForMonths(months) {
  if (months < 4) return null;
  for (const b of BANDS_BOUNDS) {
    if (months < b.maxMonths) return b.key;
  }
  return '18-24';
}

export function ageStatus(months) {
  if (months < 4) return 'too-young';
  if (months >= 25) return 'too-old';
  return 'in-range';
}
