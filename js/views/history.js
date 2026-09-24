import { getState, navigate } from '../app.js';
import { groupByDay, dayBarSegments } from '../history-data.js';
import { createMilestone, active, durationMinutes, localDayKey } from '../model.js';
import { put } from '../store.js';
import { tabs } from './tabs.js';
import { formatTime } from '../format.js';

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
    ${days.map((d) => {
      const primarySleeps = active(d.sleeps)
        .filter((s) => localDayKey(new Date(s.startedAt)) === d.dayKey)
        .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
      return `
      <div class="card">
        <strong>${d.dayKey}</strong>
        <div class="daybar" role="img" aria-label="Sleep across the day">
          ${dayBarSegments(d.sleeps, d.dayKey).map((g) => {
            const src = active(d.sleeps).find((s) => s.id === g.id);
            const label = src
              ? `${src.type === 'nap' ? 'Nap' : 'Night'} ${formatTime(new Date(src.startedAt))}${
                  src.endedAt ? ' – ' + formatTime(new Date(src.endedAt)) : ''}`
              : '';
            return `<span class="seg seg-${g.type}" style="left:${g.leftPct}%;width:${g.widthPct}%"`
              + ` title="${label}"></span>`;
          }).join('')}
        </div>
        <div class="daybar-axis" aria-hidden="true">
          <span style="left:0%">12a</span>
          <span style="left:25%">6a</span>
          <span style="left:50%">12p</span>
          <span style="left:75%">6p</span>
          <span style="left:100%">12a</span>
        </div>
        <div class="muted">Day ${hm(d.dayMin)} · Night ${hm(d.nightMin)}</div>
        ${primarySleeps.length === 0 ? '' : `
          <ul class="sleep-list">
            ${primarySleeps.map((x) => {
              const started = formatTime(new Date(x.startedAt));
              if (x.skipped) {
                return `<li data-edit="${x.id}">
                  <strong>${x.type === 'nap' ? 'Nap' : 'Night'}</strong>
                  <span class="muted">${started} · skipped</span>
                </li>`;
              }
              const ended = x.endedAt ? formatTime(new Date(x.endedAt)) : 'in progress';
              const dur = x.endedAt ? ` <span class="muted">(${durationMinutes(x)} min)</span>` : '';
              return `<li data-edit="${x.id}">
                <strong>${x.type === 'nap' ? 'Nap' : 'Night'}</strong>
                <span class="muted">${started} – ${ended}</span>${dur}
              </li>`;
            }).join('')}
          </ul>`}
        ${d.milestones.map((m) =>
          `<div class="muted">★ ${MILESTONE_LABELS[m.kind]}</div>`).join('')}
      </div>`;
    }).join('')}

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

  container.querySelectorAll('[data-edit]').forEach((el) =>
    el.addEventListener('click', () => navigate('edit-sleep', { sleepId: el.dataset.edit })));
}
