import { suggest } from '../engine.js';
import { getState, bandKey, navigate } from '../app.js';
import { createSleep, durationMinutes, active, localDayKey } from '../model.js';
import { put } from '../store.js';
import { tabs } from './tabs.js';

let timer = null;

const two = (n) => String(n).padStart(2, '0');
const clock = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;

export function formatWindow(start, end) {
  return `${clock(start)} – ${clock(end)}`;
}

export function formatCountdown(ms) {
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

function reasonsHtml(reasons) {
  return reasons.map((r) => `
    <div class="reason">
      <span class="tier tier-${r.tier}">${tierLabel(r.tier)}</span>
      <p>${r.text}</p>
    </div>`).join('');
}

function tierLabel(tier) {
  if (tier === 'A1') return 'Published guideline';
  if (tier === 'A2') return 'Research evidence';
  if (tier === 'B') return 'Observed in studies';
  return 'Common practice';
}

export async function render(container) {
  const s = getState();
  const now = new Date();
  const key = bandKey(now);
  const sug = suggest({ now, bandKey: key, sleeps: s.sleeps, adjustments: active(s.adjustments) });
  const open = active(s.sleeps).find((x) => !x.endedAt);

  const todayKey = localDayKey(now);
  const todays = active(s.sleeps)
    .filter((x) => localDayKey(new Date(x.startedAt)) === todayKey)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  container.innerHTML = `
    ${tabs('today')}
    <h1>${s.child.name}</h1>
    <div class="card" id="suggestion">${suggestionHtml(sug, open, now)}</div>
    <button class="btn" id="primary">${primaryLabel(open, sug)}</button>
    <h2>Today</h2>
    ${todays.length === 0 ? '<p class="muted">Nothing logged yet.</p>' : ''}
    ${todays.map((x) => `<div class="card">
        <strong>${x.type === 'nap' ? 'Nap' : 'Night'}</strong>
        <span class="muted">${clock(new Date(x.startedAt))}${
          x.endedAt ? ' – ' + clock(new Date(x.endedAt)) : ' – in progress'}</span>
        ${x.endedAt ? `<div class="muted">${durationMinutes(x)} min</div>` : ''}
      </div>`).join('')}`;

  container.querySelector('#primary').addEventListener('click', async () => {
    const st = getState();
    const current = active(st.sleeps).find((x) => !x.endedAt);
    if (current) {
      await put(st.db, 'sleeps', { ...current, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } else {
      const type = sug.kind === 'bedtime' ? 'night' : 'nap';
      await put(st.db, 'sleeps', createSleep({ type, startedAt: new Date().toISOString() }));
    }
    location.reload();
  });

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));

  clearInterval(timer);
  timer = setInterval(() => {
    const el = container.querySelector('#countdown');
    if (!el || !sug.windowStart) return;
    el.textContent = formatCountdown(sug.windowStart - new Date());
  }, 30000);
}

function primaryLabel(open, sug) {
  if (open) return open.type === 'nap' ? 'End nap' : 'He\'s awake';
  return sug.kind === 'bedtime' ? 'Down for the night' : 'Start nap';
}

function suggestionHtml(sug, open, now) {
  if (open) {
    return `<p class="muted">${open.type === 'nap' ? 'Napping' : 'Asleep'} since
      ${clock(new Date(open.startedAt))}</p>`;
  }
  if (sug.kind === 'unknown') {
    return '<p class="muted">Add his details to get suggestions.</p>';
  }
  const heading = sug.kind === 'bedtime' ? 'Bedtime' : `Nap ${sug.napIndex + 1}`;
  const dur = sug.targetDuration
    ? `<p class="muted">Aim for about ${sug.targetDuration.minMin}–${sug.targetDuration.maxMin} minutes.</p>`
    : '';
  const low = sug.confidence === 'low'
    ? '<p class="muted">This is a rough estimate — more logged sleeps will sharpen it.</p>' : '';
  return `<h2>${heading}</h2>
    <div class="window">${formatWindow(sug.windowStart, sug.windowEnd)}</div>
    <div class="countdown" id="countdown">${formatCountdown(sug.windowStart - now)}</div>
    ${dur}${low}${reasonsHtml(sug.reasons)}`;
}
