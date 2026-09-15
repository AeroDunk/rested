import { rollingAverages } from './insights.js';

const MIN_DAYS = 7;

// 2nd-98th percentile band at 9 months (Iglowstein 2003). Deliberately wide:
// the point is to catch genuine outliers, not to worry a parent about variation.
const OUTLIER_LOW_MIN = 10.5 * 60;
const OUTLIER_HIGH_MIN = 17.4 * 60;

export function detectFlags({ sleeps, band, now = new Date() }) {
  if (!band) return [];
  const avg = rollingAverages(sleeps, 14, now);
  if (avg.sampleDays < MIN_DAYS) return [];

  const flags = [];
  if (avg.avgTotalMin < OUTLIER_LOW_MIN) {
    flags.push({
      id: 'total-low', severity: 'discuss',
      text: 'Over the last couple of weeks his daily sleep has averaged below the range '
        + 'reported for almost all babies his age. Healthy babies vary a lot, but this is '
        + 'worth raising with your pediatrician.',
    });
  }
  if (avg.avgTotalMin > OUTLIER_HIGH_MIN) {
    flags.push({
      id: 'total-high', severity: 'discuss',
      text: 'His daily sleep has averaged above the range reported for almost all babies '
        + 'his age. That is usually nothing, but it is worth mentioning at his next visit.',
    });
  }
  return flags;
}
