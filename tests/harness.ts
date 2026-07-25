// A no-dependency test harness. Node runs TypeScript directly (type stripping),
// so `npm test` needs nothing installed and nothing compiled — which matters,
// because these are the acceptance tests spec 21 §10 says must run against real
// data on the machine doing the migration.

type Fn = () => void | Promise<void>;

interface Case { suite: string; name: string; fn: Fn }

const CASES: Case[] = [];
let currentSuite = 'tests';

export function suite(name: string): void {
  currentSuite = name;
}

export function test(name: string, fn: Fn): void {
  CASES.push({ suite: currentSuite, name, fn });
}

export function ok(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

export function eq(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}\n    expected: ${b}\n    actual:   ${a}`);
}

export function throws(fn: () => unknown, matching: string | RegExp, message: string): void {
  try {
    fn();
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    const hit = typeof matching === 'string' ? text.includes(matching) : matching.test(text);
    if (!hit) throw new Error(`${message}\n    threw the wrong error: ${text}`);
    return;
  }
  throw new Error(`${message}\n    it did not throw`);
}

export async function run(): Promise<number> {
  let passed = 0;
  const failures: { case: Case; error: string }[] = [];
  let lastSuite = '';

  for (const c of CASES) {
    if (c.suite !== lastSuite) {
      console.log(`\n${c.suite}`);
      lastSuite = c.suite;
    }
    try {
      await c.fn();
      passed++;
      console.log(`  ok    ${c.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ case: c, error: msg });
      console.log(`  FAIL  ${c.name}`);
      console.log(`        ${msg.split('\n').join('\n        ')}`);
    }
  }

  console.log(`\n${passed}/${CASES.length} passed${failures.length ? `, ${failures.length} FAILED` : ''}`);
  return failures.length ? 1 : 0;
}
