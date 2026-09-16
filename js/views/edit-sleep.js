import { getState, navigate } from '../app.js';
import { put } from '../store.js';
import { createWaking, softDelete, active } from '../model.js';
import { formatTime, toLocalInputValue, fromLocalInputValue } from '../format.js';

export async function render(container, { sleepId }) {
  const s = getState();
  const sleep = active(s.sleeps).find((x) => x.id === sleepId);
  if (!sleep) { await navigate('today'); return; }

  const wakings = active(s.wakings).filter((w) => w.sleepId === sleepId)
    .sort((a, b) => new Date(a.wokeAt) - new Date(b.wokeAt));

  container.innerHTML = `
    <h1>${sleep.type === 'nap' ? 'Nap' : 'Night sleep'}</h1>
    <form id="ed">
      <label class="field"><span>Started</span>
        <input type="datetime-local" name="startedAt"
          value="${toLocalInputValue(new Date(sleep.startedAt))}" required></label>
      <label class="field"><span>Ended</span>
        <input type="datetime-local" name="endedAt"
          value="${sleep.endedAt ? toLocalInputValue(new Date(sleep.endedAt)) : ''}"></label>
      <label class="field"><span>How did it go?</span>
        <select name="mood">
          <option value="">Not noted</option>
          <option value="easy"${sleep.mood === 'easy' ? ' selected' : ''}>Easy</option>
          <option value="fussy"${sleep.mood === 'fussy' ? ' selected' : ''}>Fussy</option>
          <option value="rough"${sleep.mood === 'rough' ? ' selected' : ''}>Rough</option>
        </select></label>
      ${sleep.type === 'night' ? `
      <label class="field"><span>
        <input type="checkbox" name="routineFollowed"${sleep.routineFollowed ? ' checked' : ''}>
        Followed the usual bedtime routine</span></label>
      <p class="muted">Keeping the routine the same on at least five nights a week is
        the best-evidenced thing you can do for his sleep.</p>` : ''}
      <label class="field"><span>Note</span>
        <textarea name="note" rows="2">${sleep.note ?? ''}</textarea></label>
      <p id="err" class="muted" hidden></p>
      <button class="btn" type="submit">Save</button>
    </form>

    ${sleep.type === 'night' ? `
    <h2>Night wakings</h2>
    ${wakings.length === 0 ? '<p class="muted">None logged.</p>' : ''}
    ${wakings.map((w) => `<div class="card">
      ${formatTime(new Date(w.wokeAt))}
      ${w.backAsleepAt ? '– ' + formatTime(new Date(w.backAsleepAt)) : ''}
      <button class="btn secondary" data-del-waking="${w.id}">Remove</button>
    </div>`).join('')}
    <form id="addw">
      <label class="field"><span>Woke at</span>
        <input type="datetime-local" name="wokeAt" required></label>
      <label class="field"><span>Back to sleep at</span>
        <input type="datetime-local" name="backAsleepAt"></label>
      <button class="btn secondary" type="submit">Add waking</button>
    </form>
    <p class="muted">For reference, babies this age average about one waking a night,
      and up to three is within the normal range.</p>` : ''}

    <button class="btn secondary" id="del">Delete this sleep</button>
    <button class="btn secondary" id="back">Back</button>`;

  container.querySelector('#ed').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const started = fromLocalInputValue(f.get('startedAt'));
    const endedRaw = f.get('endedAt');
    const ended = endedRaw ? fromLocalInputValue(endedRaw) : null;
    const err = container.querySelector('#err');

    if (ended && ended <= started) {
      err.hidden = false;
      err.textContent = 'The end time needs to be after the start time.';
      return;
    }
    await put(s.db, 'sleeps', {
      ...sleep,
      startedAt: started.toISOString(),
      endedAt: ended ? ended.toISOString() : null,
      mood: f.get('mood') || null,
      note: f.get('note').trim() || null,
      routineFollowed: sleep.type === 'night' ? f.get('routineFollowed') === 'on' : null,
      updatedAt: new Date().toISOString(),
    });
    location.reload();
  });

  const addw = container.querySelector('#addw');
  if (addw) {
    addw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      await put(s.db, 'wakings', createWaking({
        sleepId,
        wokeAt: fromLocalInputValue(f.get('wokeAt')).toISOString(),
        backAsleepAt: f.get('backAsleepAt')
          ? fromLocalInputValue(f.get('backAsleepAt')).toISOString() : null,
      }));
      location.reload();
    });
  }

  container.querySelectorAll('[data-del-waking]').forEach((b) =>
    b.addEventListener('click', async () => {
      const w = active(s.wakings).find((x) => x.id === b.dataset.delWaking);
      await put(s.db, 'wakings', softDelete(w));
      location.reload();
    }));

  container.querySelector('#del').addEventListener('click', async () => {
    await put(s.db, 'sleeps', softDelete(sleep));
    location.reload();
  });
  container.querySelector('#back').addEventListener('click', () => navigate('today'));
}
