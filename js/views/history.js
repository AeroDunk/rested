import { getState, navigate } from '../app.js';
import { groupByDay, dayBarSegments } from '../history-data.js';
import { createMilestone } from '../model.js';
import { put } from '../store.js';
import { tabs } from './tabs.js';

const MILESTONE_LABELS = {
  sitting: 'Sitting', crawling: 'Crawling', pullingToStand: 'Pulling to stand',
  cruising: 'Cruising', walking: 'Walking', other: 'Something new',
};

const hm = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

export async function render(container) {
  const s = getState();
  const days = groupByDay(s.sleeps, s.milestones);

  container.innerHTML = `
    ${tabs('history')}
    <h1>History</h1>
    ${days.length === 0 ? '<p class="muted">Nothing logged yet.</p>' : ''}
    ${days.map((d) => `
      <div class="card">
        <strong>${d.dayKey}</strong>
        <div class="daybar" role="img" aria-label="Sleep across the day">
          ${dayBarSegments(d.sleeps, d.dayKey).map((g) =>
            `<span class="seg seg-${g.type}" style="left:${g.leftPct}%;width:${g.widthPct}%"></span>`
          ).join('')}
        </div>
        <div class="muted">Day ${hm(d.dayMin)} · Night ${hm(d.nightMin)}</div>
        ${d.milestones.map((m) =>
          `<div class="muted">★ ${MILESTONE_LABELS[m.kind]}</div>`).join('')}
      </div>`).join('')}

    <h2>Log a milestone</h2>
    <p class="muted">Babies often wake more in the weeks after learning something new,
      so noting these makes a rough patch easier to explain.</p>
    <form id="ms">
      <label class="field"><span>What happened</span>
        <select name="kind">
          ${Object.entries(MILESTONE_LABELS).map(([k, v]) =>
            `<option value="${k}">${v}</option>`).join('')}
        </select></label>
      <label class="field"><span>When</span>
        <input type="date" name="observedAt" required></label>
      <button class="btn secondary" type="submit">Add</button>
    </form>`;

  container.querySelector('#ms').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const [y, mo, d] = f.get('observedAt').split('-').map(Number);
    await put(s.db, 'milestones', createMilestone({
      kind: f.get('kind'),
      observedAt: new Date(y, mo - 1, d, 12, 0, 0).toISOString(),
    }));
    location.reload();
  });

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
