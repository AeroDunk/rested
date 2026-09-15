import * as today from './today.js';
import * as editSleep from './edit-sleep.js';

const ROUTES = { today, 'edit-sleep': editSleep };

export async function render(container, route, params = {}) {
  const view = ROUTES[route] ?? ROUTES.today;
  await view.render(container, params);
}
