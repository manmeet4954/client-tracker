# AGENTS.md — Client Dashboard (KRNL Personal Branding System)

You are working in the dashboard app **alongside Claude Code**, which co-maintains
this repo. To keep the two agents from contradicting each other, this folder —
not chat history — is the single source of truth. When a file and anyone's
memory disagree, the file wins.

## Read this before doing anything

The full operating manual lives in **`CLAUDE.md`** in this folder. It applies to
you as much as to Claude. Read it fully, then read the files below in order:

1. `CLAUDE.md` — what this dashboard is, the four jobs (Record / Fetch / Analyze /
   Decide), the design laws, and the memory rule.
2. `STATE.md` — where things stand and the single next step.
3. `types/index.ts` — the entire data model in one file.
4. `lib/access.ts` — the roles and what each may see and write.
5. The page + component pair for whatever section you are touching.
6. `DEPLOY.md` — how this ships (Vercel + Supabase) before touching anything deploy-related.
7. `specs/` — the numbered design specs for individual features.

Then report back in two lines: where the project stands and what the next step
is. Only then start work.

## Working alongside Claude

- **Work through git.** Make changes as normal edits so they show up in the diff;
  Manmeet reviews your work as a git diff, same as she does with Claude.
- **Record decisions in the files, not chat.** Any decision made this session goes
  into `STATE.md` (or `CLAUDE.md`) before the session ends. Chat is not memory.
- **Don't rewrite the operating manuals.** `CLAUDE.md` and `STATE.md` are shared
  context. If a rule genuinely needs to change, flag it to Manmeet rather than
  silently editing it out from under the other agent.
- **Follow the same conventions** `CLAUDE.md` sets for this app — don't invent a
  parallel style.

## Stack

Next.js + TypeScript + Tailwind, Supabase backend, deployed on Vercel. See
`package.json`, `next.config.js`, and `DEPLOY.md` for specifics.
