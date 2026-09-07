// Spec 37 — Sonia's money book, and the orders regression it fixes.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { normalizeState, filterStateForRole } from '../lib/access.ts';
import type { LedgerEntry } from '../types/index.ts';

const NOW = '2026-09-07T10:00:00.000Z';
const ROOT = process.cwd();

function withSonia(): ReturnType<typeof normalizeState> {
  const s = normalizeState(fixtureState());
  // Name the profile so the legacy binding rules bind `sonia` to it, and give
  // the sonia role a client binding (that is exactly what deriveLegacyBindings
  // writes for a crochet-named profile).
  const id = s.clients[0].id;
  s.clients[0] = { ...s.clients[0], name: "Sonia's Crochet" };
  s.bindings = [{ role: 'sonia', profileId: id, kind: 'client', createdAt: NOW }];
  return s;
}

function order(id: string) {
  return { id, name: 'Neha', items: '2 scarves', amount: 1200, orderType: 'full',
    paymentStatus: 'received' as const, deliveryStatus: 'delivered' as const, createdAt: NOW };
}
function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return { id: 'l1', note: 'x', amount: 100, kind: 'income', received: true,
    month: '2026-09', createdAt: NOW, ...over };
}

suite('spec 37 — Sonia keeps her own shop data');

test('her orders and ledger survive the filter; a content client’s do not', () => {
  const s = withSonia();
  const id = s.clients[0].id;
  s.clientData[id] = { ...s.clientData[id], orders: [order('o1')], ledger: [entry({})] };

  // Sonia (legacy login) receives her orders and her money book.
  const asSonia = filterStateForRole(s, 'sonia').clientData[id];
  eq(asSonia.orders.length, 1, 'Sonia sees her orders again (the 08-17 regression is gone)');
  eq(asSonia.ledger.length, 1, 'and her money book');

  // The owner sees everything.
  eq(filterStateForRole(s, 'owner').clientData[id].orders.length, 1, 'owner sees orders');

  // A CONTENT client bound to the same profile would NOT (shop slices stripped
  // for a non-legacy login). Simulate one by binding merushri as a client.
  const s2 = withSonia();
  const id2 = s2.clients[0].id;
  s2.clients[0] = { ...s2.clients[0], name: 'Career Bubble' };  // not a legacy shop name
  s2.bindings = [{ role: 'merushri', profileId: id2, kind: 'client', createdAt: NOW }];
  s2.clientData[id2] = { ...s2.clientData[id2], orders: [order('o1')], ledger: [entry({})] };
  const asContent = filterStateForRole(s2, 'merushri').clientData[id2];
  eq(asContent.orders.length, 0, 'a content client receives no orders');
  eq(asContent.ledger.length, 0, 'and no money book');
});

suite('spec 37 — the balance reads honestly');

test('in hand is received income minus spend; still-to-come is separate', () => {
  const list = [
    entry({ id: 'a', kind: 'income', amount: 1000, received: true }),
    entry({ id: 'b', kind: 'income', amount: 3000, received: false }),
    entry({ id: 'c', kind: 'expense', amount: 500, received: true }),
  ];
  const receivedIn = list.filter(e => e.kind === 'income' && e.received).reduce((t, e) => t + e.amount, 0);
  const stillToCome = list.filter(e => e.kind === 'income' && !e.received).reduce((t, e) => t + e.amount, 0);
  const spent = list.filter(e => e.kind === 'expense').reduce((t, e) => t + e.amount, 0);
  eq(receivedIn - spent, 500, 'in hand = 1000 received − 500 spent');
  eq(stillToCome, 3000, 'still to come is the unpaid income, kept out of in-hand');

  // The view computes exactly this. Pin the shape so it cannot drift.
  const view = readFileSync(join(ROOT, 'components/MoneyView.tsx'), 'utf8');
  ok(/const inHand = receivedIn - spent;/.test(view), 'in hand = received − spent');
  ok(/kind === 'income' && !e\.received/.test(view), 'still-to-come is unpaid income');
});

suite('spec 37 — the tab reaches Sonia and only Sonia');

test('the Money tab is in her legacy workspace, filtered to her role', () => {
  const layout = readFileSync(join(ROOT, 'app/client/[id]/layout.tsx'), 'utf8');
  ok(/label: 'Money', href: '\/money'/.test(layout), 'the Money tab exists');
  ok(/\['\/references', '\/money', '\/orders', '\/catalogue'\]/.test(layout),
    "and is in sonia's visible set");
});

suite('spec 37 — the owner reaches the money book from her new dashboard');

test('Money is a pipeline in the new shell, mounted beside Orders', () => {
  // Her question: "where can I find these in my new dashboard? I should be able
  // to access these things as well." The money book was built on Sonia's legacy
  // layout only; the owner works from the new shell, so it has to live there too.
  const logsLib = readFileSync(join(ROOT, 'lib/creation/logs.ts'), 'utf8');
  ok(/id: 'money', label: 'Money'/.test(logsLib), 'Money is a registered pipeline');

  const logs = readFileSync(join(ROOT, 'components/creation/Logs.tsx'), 'utf8');
  ok(/open\.item\.id === 'money' && <MoneyView/.test(logs),
    'and the new-shell Logs mounts it');
});
