import { getState, bandKey, navigate } from '../app.js';
import { rollingAverages, routineStreak, compareToBand } from '../insights.js';
import { expectationsFor } from '../content.js';
import { BANDS } from '../sleep-data.js';
import { proposeAdjustment } from '../learning.js';
import { put } from '../store.js';
import { newId } from '../model.js';
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

  const proposal = band ? proposeAdjustment(s.sleeps, band) : null;
  const activeAdj = s.adjustments.find((a) => a.active && !a.deletedAt);
  const proposalCard = proposal && !activeAdj ? `
    <div class="card"><h2>Something we noticed</h2>
      <p>His easy naps have been following about ${Math.round(proposal.observedMedian)} minutes
        awake, rather than the ${Math.round(proposal.conventionMid)} minutes typical for his age.
        That is based on ${proposal.sampleSize} naps.</p>
      <p class="muted">Want suggestions to use his pattern instead?</p>
      <button class="btn" id="accept-adj">Use his pattern</button>
      <button class="btn secondary" id="reject-adj">No thanks</button>
    </div>` : '';

  container.innerHTML = `
    ${tabs('insights')}
    <h1>Insights</h1>
    ${proposalCard}
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

  const acc = container.querySelector('#accept-adj');
  if (acc) {
    acc.addEventListener('click', async () => {
      await put(s.db, 'adjustments', {
        id: newId(), kind: 'wakeWindow', offsetMinutes: proposal.offsetMinutes,
        ageBandAtCreation: key, acceptedAt: new Date().toISOString(), active: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
      });
      location.reload();
    });
    container.querySelector('#reject-adj').addEventListener('click', async () => {
      await put(s.db, 'adjustments', {
        id: newId(), kind: 'wakeWindow', offsetMinutes: 0,
        ageBandAtCreation: key, acceptedAt: new Date().toISOString(), active: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
      });
      location.reload();
    });
  }
}
