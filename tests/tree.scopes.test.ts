// Spec 21 §10.10 — the save-race test, and the write door's law-4 refusal.
//
// The race is real and old (CLAUDE.md gotcha 2): both saves POST the whole blob,
// so whoever lands second wins on EVERYTHING. These tests hold the fix in place.

import { suite, test, ok, eq } from './harness.ts';
import { applyScopes, changedScopes, checkScopes, scopeKey, PROFILE_SCOPES, OWNER_SCOPES } from '../lib/tree/scopes.ts';
import { emptyBody, putEntry } from '../lib/tree/body.ts';
import { isDeclared } from '../lib/tree/declarations.ts';
import { fixtureState } from './fixtures.ts';

suite('spec 21 §3.4 — path-scoped writes');

test('every scope resolves to a declared path (law 4)', () => {
  for (const p of Object.keys(PROFILE_SCOPES)) ok(isDeclared(p), `profile scope "${p}" is undeclared`);
  for (const p of Object.keys(OWNER_SCOPES)) ok(isDeclared(p), `owner scope "${p}" is undeclared`);
});

test('a write declaring an undeclared path is refused at the door', () => {
  const rejected = checkScopes([scopeKey('resumeguru', 'work-log/creation/secret-lane')]);
  eq(rejected.length, 1, 'the door refuses what the tree never declared');
  ok(rejected[0].reason.includes('law 4'), 'and says why');
  eq(checkScopes([scopeKey('resumeguru', 'work-log/creation')]), [], 'a declared path passes');
});

test('a save declares only what it touched', () => {
  const base = fixtureState();
  const next = structuredClone(base);
  next.clientData['resumeguru'].contentCards[0].title = 'Salary question, rewritten';
  const scopes = changedScopes(base, next);
  eq(scopes, [scopeKey('resumeguru', 'work-log/creation')],
    'one edit to a piece declares one path — not the whole blob');
});

suite('spec 21 §10.10 — the save-race test');

test('two concurrent writes to different paths both survive', () => {
  const stored = fixtureState();

  // Two tabs loaded the same state. Tab A edits a content piece; tab B, a
  // minute later, adds a cold call to the same profile.
  const tabA = structuredClone(stored);
  tabA.clientData['resumeguru'].contentCards[0].title = 'A wrote this';
  const scopesA = changedScopes(stored, tabA);

  const tabB = structuredClone(stored);
  tabB.clientData['resumeguru'].coldCalls.push({
    id: 'cc-2', name: 'New lead', phone: '', location: '', status: 'open',
    response: '', notes: '', createdAt: '2026-07-25T10:00:00.000Z',
  });
  const scopesB = changedScopes(stored, tabB);

  // A lands first, then B — B never saw A's edit.
  const afterA = applyScopes(stored, tabA, scopesA);
  const afterB = applyScopes(afterA, tabB, scopesB);

  eq(afterB.clientData['resumeguru'].contentCards[0].title, 'A wrote this',
    'the later save did not erase the earlier one');
  eq(afterB.clientData['resumeguru'].coldCalls.length, 2, 'and its own work landed');
});

test('a save never touches a profile it did not declare', () => {
  const stored = fixtureState();
  const mine = structuredClone(stored);
  mine.clientData['resumeguru'].postTarget = 12;
  // A forged or stale payload also carrying another profile's data:
  mine.clientData['divine-studio'].leadAnswers = [];

  const next = applyScopes(stored, mine, changedScopes(stored, { ...mine, clientData: { ...mine.clientData, 'divine-studio': stored.clientData['divine-studio'] } }));
  eq(next.clientData['divine-studio'].leadAnswers.length, 1,
    'Divine’s reply scripts are untouched, because that path was never declared');
  eq(next.clientData['resumeguru'].postTarget, 12, 'and the declared change landed');
});

test('owner-level paths scope separately from profile paths', () => {
  const stored = fixtureState();
  const tabA = structuredClone(stored);
  tabA.personalTasks.push({
    id: 't-2', text: 'Divine carousel', bucket: 'today', taskType: 'client-task',
    clientIds: ['divine-studio'], done: false, createdAt: '2026-07-25T10:00:00.000Z',
  });
  const tabB = structuredClone(stored);
  tabB.clientData['resumeguru'].momentum!.entries.push({ date: '2026-07-25', actions: ['story'] });

  const merged = applyScopes(applyScopes(stored, tabA, changedScopes(stored, tabA)), tabB, changedScopes(stored, tabB));
  eq(merged.personalTasks.length, 2, 'her day survives');
  eq(merged.clientData['resumeguru'].momentum!.entries.length, 2, 'so does the effort log');
});

test('body writes scope by tree path, not by profile', () => {
  const stored = fixtureState();
  let body = emptyBody('2026-07-25T09:00:00.000Z');
  body = putEntry(body, 'work-log/logs/observations',
    { id: 'o-1', type: 'observation', data: { topic: 'Reels', text: 'saves climbing' } },
    { writer: 'owner', now: '2026-07-25T09:00:00.000Z' });
  stored.clientData['resumeguru'].body = body;

  const tabA = structuredClone(stored);
  tabA.clientData['resumeguru'].body!.paths['work-log/logs/observations'][0].data.text = 'saves doubled';
  const tabB = structuredClone(stored);
  tabB.clientData['resumeguru'].body = putEntry(tabB.clientData['resumeguru'].body!,
    'work-log/creation/channels',
    { id: 'ch-ig', type: 'channel', data: { platform: 'Instagram' } },
    { writer: 'owner', now: '2026-07-25T09:05:00.000Z' });

  const merged = applyScopes(applyScopes(stored, tabA, changedScopes(stored, tabA)), tabB, changedScopes(stored, tabB));
  eq(merged.clientData['resumeguru'].body!.paths['work-log/logs/observations'][0].data.text, 'saves doubled',
    'the observation edit survived');
  eq(merged.clientData['resumeguru'].body!.paths['work-log/creation/channels'].length, 1,
    'and so did the channel written at a different address');
});

test('with no baseline, a save behaves exactly as it does today', () => {
  const stored = fixtureState();
  const scopes = changedScopes(null, stored);
  ok(scopes.length > 10, 'a first save declares everything it holds — honest, and no worse than the old door');
  eq(checkScopes(scopes), [], 'and every one of those paths is declared');
});
