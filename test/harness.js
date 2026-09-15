const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function eq(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`expected ${e}, got ${a}`);
}

export function ok(value, msg = 'expected truthy') {
  if (!value) throw new Error(`${msg} (got ${JSON.stringify(value)})`);
}

export function throws(fn, msg = 'expected a throw') {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}

export async function runAll(outEl) {
  let pass = 0, fail = 0;
  const lines = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      pass++;
      lines.push('PASS ' + name);
    } catch (e) {
      fail++;
      lines.push('FAIL ' + name + ' :: ' + e.message);
    }
  }
  lines.push(`SUMMARY pass=${pass} fail=${fail}`);
  const report = lines.join('\n');
  if (outEl) outEl.textContent = report;
  try {
    await fetch('/results', { method: 'POST', body: report });
  } catch { /* running in a normal browser, not the harness */ }
  return report;
}
