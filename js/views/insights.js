import { getState, bandKey, navigate } from '../app.js';
import { rollingAverages, routineStreak, compareToBand } from '../insights.js';
import { expectationsFor } from '../content.js';
import { BANDS } from '../sleep-data.js';
import { tabs } from './tabs.js';

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

const TIER_LABEL = {
  A1: 'Published guideline', A2: 'Research evidence',
  B: 'Observed in studies', C: 'Common practice',
};

export async function render(container) {
  const s = getState();
  const now = new Date();
  const key = bandKey(now);
  const band = BANDS[key];
  const avg = rollingAverages(s.sleeps, 14, now);
  const routine = routineStreak(s.sleeps);
  const cmp = band ? compareToBand(avg.avgTotalMin, band) : null;

  const comparison = !band || avg.sampleDays === 0
    ? '<p class="muted">Log a few days and his averages will show up here.</p>'
    : `<p>Averaging ${hm(avg.avgTotalMin)} a day over ${avg.sampleDays} day${
        avg.sampleDays === 1 ? '' : 's'}.</p>
       <p class="muted">Babies this age typically sleep ${cmp.normMinHours}–${cmp.normMaxHours}
         hours in twenty-four. ${cmp.status === 'within'
           ? 'He is right in that range.'
           : 'He is outside that range — worth mentioning at his next check-up, though the '
             + 'normal spread between healthy babies is very wide.'}</p>
       <p class="muted">Naps ${avg.avgNapCount} a day · Day ${hm(avg.avgDayMin)}
         · Night ${hm(avg.avgNightMin)}</p>`;

  const routineCard = routine.nightsLogged === 0
    ? '<p class="muted">Tick "followed the usual routine" on a night sleep to track this.</p>'
    : `<p>Routine followed on ${routine.nightsWithRoutine} of the last
        ${routine.nightsLogged} nights.</p>
       <p class="muted">${routine.meetsThreshold
         ? 'That is at or above five nights a week, which is the level shown to help.'
         : 'Five nights a week is the level at which a consistent routine has been shown to '
           + 'improve settling and night waking.'}</p>`;

  container.innerHTML = `
    ${tabs('insights')}
    <h1>Insights</h1>
    <div class="card"><h2>Sleep totals</h2>${comparison}</div>
    <div class="card"><h2>Bedtime routine</h2>${routineCard}
      <p class="muted"><span class="tier tier-A2">${TIER_LABEL.A2}</span></p></div>
    <div class="card"><h2>What to expect</h2>
      ${expectationsFor(key).map((e) => `
        <div class="reason">
          <span class="tier tier-${e.tier}">${TIER_LABEL[e.tier]}</span>
          <p>${e.text}</p>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
