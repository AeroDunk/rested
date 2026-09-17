import { getState, navigate } from '../app.js';
import { put, clearAll, getAll, STORES } from '../store.js';
import { tabs } from './tabs.js';

export async function render(container) {
  const s = getState();
  const adj = s.adjustments.filter((a) => a.active && !a.deletedAt);

  container.innerHTML = `
    ${tabs('settings')}
    <h1>Settings</h1>
    <div class="card"><h2>${s.child.name}</h2>
      <p class="muted">Born ${s.child.dob}${s.child.gestationalWeeksAtBirth
        ? ` at ${s.child.gestationalWeeksAtBirth} weeks — ages are corrected` : ''}</p></div>

    <div class="card"><h2>Personal adjustments</h2>
      ${adj.length === 0 ? '<p class="muted">None active. Suggestions use published age norms.</p>'
        : adj.map((a) => `<p>Awake stretches shifted by ${a.offsetMinutes > 0 ? '+' : ''}${
            a.offsetMinutes} minutes
          <button class="btn secondary" data-clear-adj="${a.id}">Turn off</button></p>`).join('')}
    </div>

    <div class="card"><h2>Safe sleep</h2>
      <ul class="muted">
        <li>On his back for every sleep, until he turns one.</li>
        <li>Firm, flat surface. Nothing in the crib but a fitted sheet.</li>
        <li>Share a room, not a bed, ideally for at least the first six months.</li>
        <li>Car seats, swings and strollers aren't for routine sleep.</li>
        <li>Stop swaddling as soon as he tries to roll.</li>
      </ul>
      <p class="muted">Summarised from the American Academy of Pediatrics, 2022.</p>
    </div>

    <div class="card"><h2>Your data</h2>
      <p class="muted">Everything is stored on this phone only. Export sends
        a JSON snapshot of every logged sleep, waking, milestone, and setting.</p>
      <button class="btn secondary" id="share">Share (Messages, email, …)</button>
      <button class="btn secondary" id="copy">Copy to clipboard</button>
      <button class="btn secondary" id="show-json">Show as text</button>
      <p id="export-status" class="muted" hidden></p>
    </div>

    <div class="card"><h2>Danger zone</h2>
      <button class="btn secondary" id="reset">Delete everything</button>
    </div>

    <div class="card notice"><p>This app is a planning aid, not medical advice.
      His cues matter more than any suggestion here, and anything that worries you
      belongs with your pediatrician.</p></div>`;

  async function buildDump() {
    const dump = {};
    for (const st of STORES) dump[st] = await getAll(s.db, st);
    return JSON.stringify(dump, null, 2);
  }

  function setStatus(msg) {
    const el = container.querySelector('#export-status');
    el.textContent = msg;
    el.hidden = false;
  }

  container.querySelector('#share').addEventListener('click', async () => {
    const text = await buildDump();
    if (!navigator.share) {
      setStatus('Sharing isn\'t supported here — try Copy to clipboard or Show as text.');
      return;
    }
    try {
      const file = new File([text], `rested-${new Date().toISOString().slice(0, 10)}.json`,
        { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rested export' });
      } else {
        await navigator.share({ text, title: 'Rested export' });
      }
      setStatus('Shared.');
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('Share failed — try Copy to clipboard.');
    }
  });

  container.querySelector('#copy').addEventListener('click', async () => {
    const text = await buildDump();
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      setStatus('Clipboard isn\'t available — try Show as text.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied. Paste it anywhere.');
    } catch {
      setStatus('Copy failed — try Show as text.');
    }
  });

  container.querySelector('#show-json').addEventListener('click', async () => {
    const text = await buildDump();
    const existing = container.querySelector('#export-textarea');
    if (existing) existing.remove();
    const box = document.createElement('textarea');
    box.id = 'export-textarea';
    box.value = text;
    box.rows = 12;
    box.readOnly = true;
    box.style.width = '100%';
    container.querySelector('#show-json').insertAdjacentElement('afterend', box);
    box.focus();
    box.setSelectionRange(0, box.value.length);
    setStatus('Text shown below — long-press and choose Select All, then Copy.');
  });

  container.querySelector('#reset').addEventListener('click', async () => {
    if (!confirm('Delete all logged sleep and start over? This cannot be undone.')) return;
    await clearAll(s.db);
    location.reload();
  });

  container.querySelectorAll('[data-clear-adj]').forEach((b) =>
    b.addEventListener('click', async () => {
      const a = s.adjustments.find((x) => x.id === b.dataset.clearAdj);
      await put(s.db, 'adjustments', { ...a, active: false, updatedAt: new Date().toISOString() });
      location.reload();
    }));

  container.querySelectorAll('nav.tabs button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}
