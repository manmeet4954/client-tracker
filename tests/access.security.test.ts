// Spec 21 §10.6 — the no-fifth-door test, and spec 12's security test re-run
// against the new resolver.
//
// This is the file that has to stay green forever: CLAUDE.md rule 2 says the
// server-side filtering is the product's guarantee, and §6 rewrote how it
// decides. Every check below is a forged payload or a leak that would matter.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { allowedClientIds, filterStateForRole, mergeRoleWrite, normalizeState } from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import type { AppState } from '../types/index.ts';

const NOW = '2026-07-25T12:00:00.000Z';

/** The fixture with ResumeGuru migrated and Career Bubble given a client login. */
function stateWithBodies(): AppState {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === 'resumeguru')!;
  state.clientData['resumeguru'].body = migrateProfile(rg, state.clientData['resumeguru'], { now: NOW, observations: state.observations }).body;

  const cb = state.clients.find(c => c.id === 'career-bubble')!;
  const migrated = migrateProfile(cb, state.clientData['career-bubble'], { now: NOW });
  // Give Career Bubble something at every kind of address so the filter has
  // real work to do: an asset (a give-point) and an observation (hers only).
  let body = migrated.body;
  body = {
    ...body,
    paths: {
      ...body.paths,
      'work-log/assets/sets': [{
        id: 'set-cb', path: 'work-log/assets/sets', type: 'asset_set', state: 'active',
        data: { name: 'Shoot 1' }, created_at: NOW, updated_at: NOW,
      }],
      'work-log/logs/observations': [{
        id: 'obs-cb', path: 'work-log/logs/observations', type: 'observation', state: 'active',
        data: { topic: 'Client calls', text: 'They keep missing the review window' }, created_at: NOW, updated_at: NOW,
      }],
      'context/content-strategy/goals': [{
        id: 'goal-cb', path: 'context/content-strategy/goals', type: 'goal', state: 'active',
        data: { label: 'Signups' }, created_at: NOW, updated_at: NOW,
      }],
    },
  };
  state.clientData['career-bubble'].body = body;
  return state;
}

suite('spec 21 §6 — access binds by profile id, never by name');

test('1. the owner still gets everything', () => {
  const s = filterStateForRole(stateWithBodies(), 'owner');
  eq(s.clients.length, 3, 'every profile');
  eq(s.personalTasks.length, 1, 'her day');
  eq(s.chatLog.length, 2, 'her chat');
});

test('2. a client login gets only the profile it is bound to', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  eq(s.clients.map(c => c.id), ['career-bubble'], 'one profile, the bound one');
  ok(!s.clientData['resumeguru'], 'and nothing of hers');
});

test('3. renaming a profile no longer changes anyone’s access', () => {
  const base = stateWithBodies();
  const renamed: AppState = {
    ...base,
    clients: base.clients.map(c => c.id === 'career-bubble' ? { ...c, name: 'CB Media' } : c),
  };
  eq(allowedClientIds(normalizeState(renamed), 'merushri'), ['career-bubble'],
    'the binding is to the id — the old name regexes would have cut this login off');
});

test('4. a login with no binding sees nothing', () => {
  const base = stateWithBodies();
  const noBindings: AppState = { ...base, bindings: base.bindings.filter(b => b.role !== 'shiva') };
  eq(allowedClientIds(normalizeState(noBindings), 'shiva'), [], 'no binding, no profile');
  eq(filterStateForRole(noBindings, 'shiva').clients, [], 'and an empty shelf');
});

test('5. a pre-restructure blob keeps every login working (one-time seed)', () => {
  const base = fixtureState();
  const { bindings, ...withoutBindings } = base;
  const norm = normalizeState(withoutBindings as AppState);
  ok(norm.bindings.some(b => b.role === 'merushri' && b.profileId === 'career-bubble'),
    'the access the name rules were granting is written down once');
  ok(norm.bindings.some(b => b.role === 'intern' && b.profileId === 'divine-studio'),
    'including the intern’s');
});

test('6. a paused profile revokes the client login but not her own access (S22)', () => {
  const base = stateWithBodies();
  const paused: AppState = {
    ...base,
    clients: base.clients.map(c => c.id === 'career-bubble' ? { ...c, lifecycle: 'paused' as const } : c),
  };
  eq(allowedClientIds(normalizeState(paused), 'merushri'), [], 'the client is out');
  eq(filterStateForRole(paused, 'owner').clients.length, 3, 'she still has the profile');
});

suite('spec 21 §10.6 — what a client login may see and write (S19)');

test('7. her private slices never cross the boundary', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  eq(s.personalTasks, [], 'no personal tasks');
  eq(s.observations, [], 'no observations');
  eq(s.chatLog, [], 'no chat thread');
  eq(s.brainDump.nodes, [], 'no brain dump');
  eq(s.containerMap.nodes, [], 'no container map');
});

test('8. a client sees only their own bindings, never anyone else’s', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  ok(s.bindings.every(b => b.role === 'merushri'), 'their own rows only');
  ok(!s.bindings.some(b => b.profileId === 'resumeguru'), 'nothing about her profiles');
});

test('9. the body a client receives is filtered by the declarations themselves', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  const paths = Object.keys(s.clientData['career-bubble'].body!.paths);
  ok(paths.includes('work-log/assets/sets'), 'assets: give-point 2');
  ok(paths.includes('context/content-strategy/goals'), 'the strategy summary: a see-point');
  ok(!paths.includes('work-log/logs/observations'), 'her private notes never reach them');
});

test('10. her sort queue is never client-facing', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  eq(s.clientData['career-bubble'].body!.sort_queue, [], 'the queue is hers');
});

test('11. a client write outside the four give-points is refused server side', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  // A forged payload trying to write her observations and the strategy.
  forged.clientData['career-bubble'].body!.paths['work-log/logs/observations'] = [{
    id: 'obs-forged', path: 'work-log/logs/observations', type: 'observation', state: 'active',
    data: { topic: 'x', text: 'injected' }, created_at: NOW, updated_at: NOW,
  }];
  forged.clientData['career-bubble'].body!.paths['context/content-strategy/goals'] = [];

  const merged = mergeRoleWrite(current, forged, 'merushri');
  const body = merged.clientData['career-bubble'].body!;
  eq(body.paths['work-log/logs/observations'][0].id, 'obs-cb', 'her observation is untouched');
  eq(body.paths['context/content-strategy/goals'].length, 1, 'and strategy cannot be emptied through a see-point');
});

test('12. a client write THROUGH a give-point lands', () => {
  const current = stateWithBodies();
  const incoming = structuredClone(filterStateForRole(current, 'merushri'));
  incoming.clientData['career-bubble'].body!.paths['work-log/assets/sets'].push({
    id: 'set-new', path: 'work-log/assets/sets', type: 'asset_set', state: 'active',
    data: { name: 'They uploaded this' }, created_at: NOW, updated_at: NOW,
  });
  const merged = mergeRoleWrite(current, incoming, 'merushri');
  eq(merged.clientData['career-bubble'].body!.paths['work-log/assets/sets'].length, 2,
    'give-point 2 works — that is the point of it');
});

test('13. a forged write to another profile’s data is ignored', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  (forged.clientData as Record<string, unknown>)['resumeguru'] = { ...current.clientData['resumeguru'], contentCards: [] };
  const merged = mergeRoleWrite(current, forged, 'merushri');
  eq(merged.clientData['resumeguru'].contentCards.length, 3, 'her pieces are still there');
});

test('14. a forged write to the profile list is ignored', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  forged.clients = [...forged.clients, { id: 'invented', name: 'Invented', color: '#000', createdAt: NOW }];
  eq(mergeRoleWrite(current, forged, 'merushri').clients.length, 3, 'the shelf comes from the authoritative state');
});

test('15. a forged write to the bindings is ignored', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  forged.bindings = [...forged.bindings, { role: 'merushri', profileId: 'resumeguru', kind: 'client' }];
  const merged = mergeRoleWrite(current, forged, 'merushri');
  ok(!merged.bindings.some(b => b.role === 'merushri' && b.profileId === 'resumeguru'),
    'a login cannot grant itself a profile');
});

test('16. a forged write to her personal slices is ignored', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  forged.personalTasks = [{ id: 'x', text: 'injected', bucket: 'today', taskType: 'personal', clientIds: [], done: false, createdAt: NOW }];
  forged.observations = [{ id: 'x', topic: 'x', text: 'injected', createdAt: NOW, updatedAt: NOW }];
  forged.chatLog = [{ id: 'x', who: 'me', text: 'injected', createdAt: NOW }];
  const merged = mergeRoleWrite(current, forged, 'merushri');
  eq(merged.personalTasks.length, 1, 'her tasks');
  eq(merged.observations.length, 2, 'her observations');
  eq(merged.chatLog.length, 2, 'her chat');
});

suite('spec 12 re-run — shared lists survive the rewrite');

test('17. a shared list is injected as a window into the bound profile', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  const lists = s.clientData['career-bubble'].lists;
  eq(lists.length, 1, 'the window is there');
  eq(lists[0].sharedFrom?.clientId, 'resumeguru', 'badged with who shared it');
  eq(s.clientData['career-bubble'].listRows.length, 1, 'with its rows');
});

test('18. nothing else of the sharing profile crosses with it', () => {
  const s = filterStateForRole(stateWithBodies(), 'merushri');
  ok(!s.clientData['resumeguru'], 'no ResumeGuru data');
  eq(s.clients.map(c => c.id), ['career-bubble'], 'and it is not on their shelf');
});

test('19. row edits route back into the owning profile, and windows are never stored', () => {
  const current = stateWithBodies();
  const incoming = structuredClone(filterStateForRole(current, 'merushri'));
  const row = incoming.clientData['career-bubble'].listRows[0];
  row.name = 'DU North Campus (confirmed)';
  const merged = mergeRoleWrite(current, incoming, 'merushri');
  eq(merged.clientData['resumeguru'].listRows[0].name, 'DU North Campus (confirmed)', 'the edit lands on the real list');
  eq(merged.clientData['career-bubble'].lists.length, 0, 'and the injected window is not stored');
});

test('20. a forged window onto a list that was never shared is refused', () => {
  const current = stateWithBodies();
  const incoming = structuredClone(filterStateForRole(current, 'merushri'));
  incoming.clientData['career-bubble'].lists = [{
    id: 'list-secret', name: 'Not shared with them', stages: [{ id: 's1', name: 'a' }],
    createdAt: NOW, sharedFrom: { clientId: 'divine-studio', clientName: 'Divine Studio' },
  }];
  incoming.clientData['career-bubble'].listRows = [
    { id: 'r-x', listId: 'list-secret', stageId: 's1', name: 'injected', createdAt: NOW, updatedAt: NOW },
  ];
  const merged = mergeRoleWrite(current, incoming, 'merushri');
  eq(merged.clientData['divine-studio'].listRows.length, 0, 'the forged window reaches nothing');
});

test('21. the list object itself is never writable through a window', () => {
  const current = stateWithBodies();
  const incoming = structuredClone(filterStateForRole(current, 'merushri'));
  incoming.clientData['career-bubble'].lists[0].name = 'Renamed by the collaborator';
  incoming.clientData['career-bubble'].lists[0].sharedWith = [{ clientId: 'career-bubble', clientName: 'CB' }];
  const merged = mergeRoleWrite(current, incoming, 'merushri');
  eq(merged.clientData['resumeguru'].lists[0].name, 'Colleges & Workshops', 'the name is hers');
  eq(merged.clientData['resumeguru'].lists[0].sharedWith?.length, 1, 'so is who it is shared with');
});

test('22. staff (the intern) keep their bound profiles and still see no owner slices', () => {
  const s = filterStateForRole(stateWithBodies(), 'intern');
  eq(s.clients.map(c => c.id).sort(), ['divine-studio', 'resumeguru'], 'both bound profiles');
  eq(s.personalTasks, [], 'and none of her private slices');
  eq(s.chatLog, [], 'including the chat');
});

test('23. staff do not see her per-profile notes either — audience: owner means owner', () => {
  const s = filterStateForRole(stateWithBodies(), 'intern');
  const paths = Object.keys(s.clientData['resumeguru'].body!.paths);
  ok(!paths.includes('work-log/logs/observations'), 'her observations stay hers');
  ok(!paths.includes('work-log/creation/topics'), 'and so does the seed bank');
  ok(!paths.includes('work-log/logs/effort'), 'and the effort log');
  eq(s.clientData['resumeguru'].body!.sort_queue, [], 'and her sort queue');
});

test('24. a staff write cannot reach an owner-only path in the body', () => {
  const current = stateWithBodies();
  const forged = structuredClone(filterStateForRole(current, 'intern'));
  forged.clientData['resumeguru'].body!.paths['work-log/logs/observations'] = [{
    id: 'obs-forged', path: 'work-log/logs/observations', type: 'observation', state: 'active',
    data: { topic: 'x', text: 'injected by staff' }, created_at: NOW, updated_at: NOW,
  }];
  const merged = mergeRoleWrite(current, forged, 'intern');
  const notes = merged.clientData['resumeguru'].body!.paths['work-log/logs/observations'] ?? [];
  ok(!notes.some(n => n.id === 'obs-forged'), 'the forged note reaches nothing');
});
