import * as today from './today.js';

const ROUTES = { today };

export async function render(container, route, params = {}) {
  const view = ROUTES[route] ?? ROUTES.today;
  await view.render(container, params);
}
