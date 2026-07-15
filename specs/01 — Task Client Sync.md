# Spec 01 — Task ↔ Client Sync ("one task, one truth")

Status: design agreed, 4 forks pending Manmeet's answers (listed at the end).
Build size: large (data model change). Ships alone.
Depends on: nothing. Independent of analytics.

---

## What it is

My Day and the client tabs become two windows onto the same work. Today the flow is one-way: content cards surface in My Day ("Going live"), but a task typed in My Day never reaches any client tab. This spec closes the loop.

## How it works

When adding a task in My Day, Manmeet picks a type:

1. **Client content** — the daily creation work (design this post, edit this reel).
   - Pick one or MORE clients (multi-select).
   - A content card is created on each chosen client's Content board, starting at Idea stage. The task's date becomes the card's go-live date.
   - Two-way sync: the My Day row is a *pointer* to the card, not a copy. Its displayed status IS the card's stage. Ticking it done in My Day moves the card to Posted. Moving the card on the board updates what My Day shows. One object, two windows.
   - A cancel/drop action for dead ideas (removes or archives the card).

2. **Client task** — occasional management work (plan the week, sort client data).
   - Pick one or more clients.
   - Becomes an agenda item on each client's Dashboard (the existing Agenda + Upcoming Deadlines area), month keyed to its due date.
   - Not a content card. Never touches the board.

3. **Personal** — plain My Day task, no client. Unchanged from today.

Reverse direction stays: content added inside a client keeps surfacing in My Day by go-live date, as now.

## Data changes

- `PersonalTask` gains: `taskType` ('content' | 'client-task' | 'personal'), `clientIds: string[]` (replaces single `clientId`, migrated), `linkedCards?: { clientId, cardId }[]`, `linkedAgenda?: { clientId, month, itemId }[]`.
- Content-type tasks render their status from the linked card's stage (no duplicated status field).
- Per CLAUDE.md rule 5: every touched slice added to `emptyState`, `normalizeState`, `filterStateForRole`, `mergeRoleWrite` in `lib/access.ts`. My Day is owner-only today; the created cards/agenda items belong to client data and flow through existing role filtering.

## Files touched

`types/index.ts`, `components/PersonalDashboard.tsx`, `contexts/AppContext.tsx` (new actions), `lib/access.ts`, possibly `components/DashboardView.tsx` (agenda item origin marker).

## Decisions — ALL LOCKED (Manmeet, 2026-07-13)

1. **Tick → Posted: YES.** Plus a cancel/drop action for dead ideas.
2. **Client tasks in My Day: YES.** Her words: the point of My Day is having everything categorized into the three categories, in one place.
3. **Stage rename: delegated to Claude.** Her condition: done vs not-done must stay unmistakable. Claude's naming (she can veto at review): keep the five internal stage ids unchanged (no migration risk), relabel only `writing` → **"Making"** (covers get-content + creation). Labels become: Idea → Making → Ready → Scheduled → Posted.
4. **Type picker confirmed**, with her upgrade: choosing **Content** opens the SAME card editor used on the Content tab (client pre-picked, go-live date pre-filled with the task's date), so pillar, stage, and type get set right there at creation — one form, no follow-up sorting. With multiple clients selected, the editor is filled once and a card is created per client.

## Out of scope

Recurring client content, team assignment, notifications.
