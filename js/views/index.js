import * as today from './today.js';
import * as editSleep from './edit-sleep.js';
import * as history from './history.js';
import * as insights from './insights.js';

const ROUTES = { today, 'edit-sleep': editSleep, history, insights };

export async function render(container, route, params = {}) {
  const view = ROUTES[route] ?? ROUTES.today;
  await view.render(container, params);
}
