const ITEMS = [
  ['today', 'Today'],
  ['history', 'History'],
  ['insights', 'Insights'],
  ['settings', 'Settings'],
];

export function tabs(current) {
  return `<nav class="tabs">${ITEMS.map(([k, label]) =>
    `<button data-route="${k}"${k === current ? ' aria-current="page"' : ''}>${label}</button>`
  ).join('')}</nav>`;
}
