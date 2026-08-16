// Invites — giving access without a deploy, 2026-08-11.
//
// The security tests are the point of this file. An invite is a row in a
// database, and a row must never be able to become the owner, reach a profile
// it was not given, or survive being taken back.

import { suite, test, eq, ok } from './harness.ts';
import {
  bindingsFor, codeFrom, findByCode, inviteIdOf, inviteLine, isGuestRole, isLive,
  makeInvite, markUsed, revoke, roleForInvite,
} from '../lib/access/invites.ts';
import { allowedClientIds, normalizeState } from '../lib/access.ts';
import { fixtureState } from './fixtures.ts';

const NOW = '2026-08-11T12:00:00.000Z';

const invite = (over: Partial<Parameters<typeof makeInvite>[0]> = {}) => makeInvite({
  id: 'i1', name: 'Riti', code: 'ABCD-EFGH-JKMN', profileIds: ['c1'], now: NOW, ...over,
});

suite('invites — access without a deploy');

test('an invite can never be the owner, or any environment role', () => {
  // The whole safety question in one line: a database row must not be able to
  // mint her login.
  const role = roleForInvite(invite());
  ok(isGuestRole(role), 'it is namespaced');
  eq(role === 'owner', false, 'never the owner');
  for (const fixed of ['owner', 'intern', 'sonia', 'shiva', 'merushri']) {
    eq(role === fixed, false, `an invite must never become ${fixed}`);
  }
  eq(inviteIdOf(role), 'i1', 'and it says which invite it is');
  eq(inviteIdOf('owner'), null, 'the owner is not an invite');
});

test('a code is matched forgivingly, because a person types it off a phone', () => {
  const list = [invite()];
  ok(!!findByCode(list, 'ABCD-EFGH-JKMN'), 'as sent');
  ok(!!findByCode(list, 'abcdefghjkmn'), 'lower case, no dashes');
  ok(!!findByCode(list, '  ABCD EFGH JKMN '), 'spaces and padding');
  eq(findByCode(list, 'ABCD-EFGH-JKMX'), null, 'but a wrong code is wrong');
  eq(findByCode(list, ''), null, 'and empty never matches');
});

test('a code that was taken back stops working immediately', () => {
  const list = revoke([invite()], 'i1', NOW);
  eq(findByCode(list, 'ABCD-EFGH-JKMN'), null, 'revoked is refused');
  eq(isLive(list[0]), false, 'no longer live');
  eq(!!list[0].revokedAt, true, 'and the record of it survives, never deleted');
});

test('an invite reaches only the profiles it was given', () => {
  const base = normalizeState(fixtureState());
  const target = base.clients[0].id;
  const inv = invite({ profileIds: [target] });
  const state = {
    ...base,
    invites: [inv],
    bindings: [...(base.bindings ?? []), ...bindingsFor(inv)],
  };
  const reachable = allowedClientIds(state, roleForInvite(inv) as never);
  eq(reachable, [target], 'exactly the one profile, and no other');
});

test('an invite with no profiles reaches nothing at all', () => {
  const base = normalizeState(fixtureState());
  const inv = invite({ profileIds: [] });
  eq(bindingsFor(inv).length, 0, 'it binds nothing');
  const state = { ...base, invites: [inv], bindings: [...(base.bindings ?? []), ...bindingsFor(inv)] };
  eq(allowedClientIds(state, roleForInvite(inv) as never).length, 0, 'nothing at all');
});

test('an invite binds as a client, never as staff', () => {
  // kind matters: staff skips the lifecycle and client-door rules entirely.
  for (const b of bindingsFor(invite({ profileIds: ['c1', 'c2'] }))) {
    eq(b.kind, 'client', 'an invited person is a client, always');
  }
});

test('an invite needs a name and a code, and refuses without either', () => {
  let threw = 0;
  try { makeInvite({ id: 'x', name: '  ', code: 'A', profileIds: [], now: NOW }); } catch { threw++; }
  try { makeInvite({ id: 'x', name: 'Riti', code: '  ', profileIds: [], now: NOW }); } catch { threw++; }
  eq(threw, 2, 'both are refused rather than stored blank');
});

test('duplicate profiles collapse, so one person is bound once', () => {
  eq(invite({ profileIds: ['c1', 'c1', 'c2'] }).profileIds.length, 2, 'bound once each');
});

test('the code is readable over a phone call', () => {
  const code = codeFrom([...Array(12).keys()].map(i => i * 7));
  eq(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), true, code);
  // The characters people mishear or mistype are absent by construction.
  for (const bad of ['O', '0', 'I', '1', 'L']) {
    eq(code.includes(bad), false, `${bad} is too easy to get wrong out loud`);
  }
});

test('use is recorded, so she can see whether anyone ever logged in', () => {
  eq(inviteLine(invite(), () => 'Divine Studio'), 'Opens Divine Studio. Not used yet.', 'fresh');
  const used = markUsed([invite()], 'i1', NOW);
  eq(inviteLine(used[0], () => 'Divine Studio'), 'Opens Divine Studio. Has logged in.', 'after a login');
  eq(inviteLine(revoke([invite()], 'i1', NOW)[0], () => 'x'), 'Taken back. They can no longer get in.', 'revoked');
  eq(inviteLine(invite({ profileIds: [] }), () => 'x'), 'Opens nothing yet. Pick a profile below.', 'no profiles');
});

test('an invite SURVIVES the save path, and never reaches a client', async () => {
  // The bug this pins: normalizeState rebuilds the state by enumeration, and
  // `invites` was missing from the list, so every save stripped the invites
  // before the database saw them. She made a code, sent it, and the client's
  // sign-in said "incorrect" because the server never held the invite at all.
  const { filterStateForRole } = await import('../lib/access.ts');
  const inv = invite();
  const state = { ...normalizeState(fixtureState()), invites: [inv] };

  const normed = normalizeState(state);
  eq((normed.invites ?? []).length, 1, 'a save no longer strips the invites');
  eq(normed.invites![0].code, inv.code, 'the code survives verbatim');

  // And the flip side: the invites array holds every live code, so it must
  // never be part of what a non-owner login receives.
  const asOwner = filterStateForRole(state, 'owner');
  eq((asOwner.invites ?? []).length, 1, 'she receives them');
  const asClient = filterStateForRole(state, 'merushri');
  eq(asClient.invites ?? [], [], 'a client receives no codes, ever');
});
