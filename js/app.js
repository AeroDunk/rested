import { openDb, put, getAll } from './store.js';
import { correctedAgeDays, ageMonths, bandKeyForMonths } from './age.js';
import * as onboarding from './views/onboarding.js';

const state = { db: null, child: null, sleeps: [], wakings: [], milestones: [], adjustments: [], route: 'today' };

export function getState() { return state; }
export function setState(patch) { Object.assign(state, patch); }

export function bandKey(now = new Date()) {
  if (!state.child) return null;
  const days = correctedAgeDays(state.child.dob, state.child.gestationalWeeksAtBirth, now);
  return bandKeyForMonths(ageMonths(days));
}

async function reload() {
  const [child, sleeps, wakings, milestones, adjustments] = await Promise.all([
    getAll(state.db, 'child'), getAll(state.db, 'sleeps'), getAll(state.db, 'wakings'),
    getAll(state.db, 'milestones'), getAll(state.db, 'adjustments'),
  ]);
  setState({ child: child[0] ?? null, sleeps, wakings, milestones, adjustments });
}

let rootEl = null;

export async function navigate(route, params = {}) {
  setState({ route, params });
  await draw();
}

async function draw() {
  if (!state.child) {
    onboarding.render(rootEl, {
      onComplete: async (child) => {
        await put(state.db, 'child', child);
        await reload();
        await navigate('today');
      },
    });
    return;
  }
  const views = await import('./views/index.js');
  await views.render(rootEl, state.route, state.params ?? {});
}

export async function mount(el) {
  rootEl = el;
  state.db = await openDb();
  await reload();
  await draw();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
