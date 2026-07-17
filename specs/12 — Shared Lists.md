# 12 — Shared Lists (collaboration on pipelines)

Requested 2026-07-17, her words: she runs workshops with Merushri and wants a list
(pipeline) to "show up in the other person's tab so that it can be possible" to work
on it together.

Decision locked 2026-07-17: **full partner.** The person a list is shared with can
add rows, move them between stages, and edit row names and notes. Only Manmeet can
share, unshare, rename, restage, or delete the list itself.

---

## The model: one list, two windows

Unlike collab content cards (twin copies with client-side sync), a shared list is ONE
list with ONE set of rows, living in the owning client's data. Sharing opens a window
onto it from another workspace. No copies, so nothing can drift.

- `TrackList.sharedWith?: CollabRef[]` — the workspaces this list is shared into.
- `TrackList.sharedFrom?: CollabRef` — ONLY ever present in a restricted role's
  filtered payload, marking an injected window. Never stored in the blob
  (`normalizeState` strips it).

## How each viewer sees it

- **Owner (and intern):** their state has every client, so the Lists tab computes the
  union client-side: the active client's own lists, plus lists from other clients
  whose `sharedWith` includes the active client. Union entries carry the true owner's
  clientId and dispatch row edits there. Badge: "Shared from {owner workspace}".
- **Restricted roles (merushri...):** `filterStateForRole` injects a copy of the
  shared list (+ its rows) into their allowed client's data, marked `sharedFrom`.
  Their UI edits it like their own list; badge "Shared by {owner}". On save,
  `mergeRoleWrite` extracts `sharedFrom` material, verifies against the
  AUTHORITATIVE state that the list really is shared with that role's client, and
  writes ONLY THE ROWS back into the owning client's data. The list object itself
  (name, stages, sharedWith) is never writable by the restricted role, and nothing
  else of the owner's data can be reached. Injected copies are stripped before the
  role's own client data is stored, so no duplicates persist.

This keeps rule 2 intact: the server-side guarantee is extended, not weakened — a
forged payload can still only touch (a) the role's own clients, (b) rows of lists
the authoritative state says are shared with them.

## UI

- Lists tab, per list, owner only: a Share control listing the other workspaces;
  toggling writes `sharedWith`. Plain copy: "Share this list", "Stop sharing".
- Shared badge on the pipeline header for everyone who isn't the owner of the list.
- Merushri's reduced tab set must include Lists (verify; add if missing).

## Out of scope (v1)

- Sharing anything other than Lists this way.
- Per-person row attribution ("who moved this") — no author tracking in rows today.
- Restricted roles sharing their own lists onward.

## Ship checklist

- [ ] Types + access functions + ListsView UI, typecheck clean.
- [ ] Node test of `filterStateForRole` / `mergeRoleWrite` (injection, write-back,
      forgery rejection) — the security-critical part gets a real test.
- [ ] Green local build; drift check (analytics v1 stays out); her go.
