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
    // Only reload on controllerchange when a controller ALREADY existed —
    // i.e., this is a genuine update. The initial installation also fires
    // controllerchange (from clients.claim in the SW's activate handler),
    // and reloading there mid-onboarding would lose the user's form input.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 15 * 60 * 1000);
    }).catch(() => {});
  }
}

export async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, message: 'Service workers aren\'t supported here.' };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: false, message: 'No service worker registered yet.' };
  await reg.update();
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'skip-waiting' });
    return { ok: true, message: 'Update ready — reloading.' };
  }
  if (reg.installing) return { ok: true, message: 'Update downloading — reload in a moment.' };
  return { ok: true, message: 'Already up to date.' };
}

export async function getCacheVersion() {
  if (!('serviceWorker' in navigator)) return null;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => { clearTimeout(timeout); resolve(e.data?.version ?? null); };
    controller.postMessage({ type: 'get-version' }, [ch.port2]);
  });
}
