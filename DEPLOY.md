# DEPLOY — how the dashboard goes live

This is the one and only procedure for putting dashboard changes on the live app.
Follow it exactly. It has landed the app many times without failing. Do not
invent a shortcut. If any step looks unclear, stop and ask Manmeet.

---

## The live address

**https://client-tracker-rose.vercel.app**

Written down here on 2026-08-17 because it was recorded nowhere and a session
could not verify its own deploy without asking her for it.

**Verifying a deploy really landed:** do NOT grep the page HTML. Next embeds the
not-found text in every page, so that proves nothing (this wasted an evening on
2026-08-16). Fetch the served JS chunks and grep for a string only the new code
contains, or open it in a real browser and look.

---

## The picture in one paragraph

The live app is a **separate GitHub repo**, `manmeet4954/client-tracker`. Vercel
watches that repo and rebuilds the site whenever its `main` changes. The app code
lives at the ROOT of that repo. In this vault, the same code lives inside the
`dashboard/` folder, and the vault is the source of truth. So "deploying" means:
take the vault's `dashboard/` folder and copy it onto the live repo, safely.

Both repos are wired up already. From the vault you can reach the live repo as the
git remote named `client-tracker`.

---

## Three gates. All three must pass. Never skip one.

1. **Green local build.** Build the app on this machine first, with fake keys. If
   it builds here, it will build on Vercel. This is what stops "it failed on the
   live site" surprises.
2. **Clean drift check.** Make sure you are not about to erase a feature that is
   live but not in the vault. This has bitten us once: a careless deploy dropped
   the Assets tab and the Map from the live app. The check below prevents it.
3. **Manmeet's explicit "go".** Never push to the live app without her word. Show
   her what will change, wait for "go", then deploy. Nothing else counts as
   permission.

---

## The steps

Set this once so the commands below can be pasted as-is:

```
VAULT="/Users/manmeetkaur/Manmeet Brain"
```

### Step 0 — Get current

```
cd "$VAULT"
git fetch origin main
git fetch client-tracker main
```

Whatever you are deploying must already be committed and merged into the vault's
`origin/main`. We always deploy from the vault's own main, never from loose edits.

### Step 1 — Build it locally first (Gate 1)

Clone the live repo into a scratch folder, drop the vault's dashboard code into it,
and build with dummy keys:

```
rm -rf /tmp/ct-deploy
git clone -q git@github.com:manmeet4954/client-tracker.git /tmp/ct-deploy
git -C "$VAULT" archive origin/main:dashboard | tar -x -C /tmp/ct-deploy
cd /tmp/ct-deploy
export NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy
export SUPABASE_SERVICE_ROLE_KEY=dummy
npm install && npm run build
```

A green build is the pass. **If the build fails, stop.** Fix it in the vault's
`dashboard/` code, merge the fix to main, and start again from Step 0. Do not
deploy a red build.

### Step 2 — Drift check (Gate 2)

Ask git what is different between the vault's dashboard and the live app:

```
cd "$VAULT"
git diff --name-status origin/main:dashboard client-tracker/main
```

Read the result:

- **Only `CLAUDE.md`, `STATE.md`, `DEPLOY.md`, or `.gitignore` listed** → safe.
  Those are docs and settings; they ride along harmlessly. Proceed.
- **Empty result** → perfectly in sync. Proceed.
- **Any real app file listed** (anything ending in `.tsx`, `.ts`, a `route.ts`, a
  component, a `lib/` file, etc.) → **STOP.** The two repos have drifted. The live
  app has work the vault doesn't, or the reverse. Deploying now could erase a live
  feature. Bring the exact list to Manmeet and reconcile before going further.

### Step 3 — Ask, and wait for "go" (Gate 3)

Tell Manmeet in plain words what this deploy changes. Wait for her to say "go".
No "go", no deploy.

### Step 4 — The deploy push

```
cd "$VAULT"
TREE=$(git rev-parse origin/main:dashboard)
NEW=$(git commit-tree "$TREE" -p "$(git rev-parse client-tracker/main)" -m "deploy: SHORT SUMMARY OF THE CHANGE")
git push client-tracker "$NEW:main"
```

Replace `SHORT SUMMARY OF THE CHANGE` with a few plain words about what shipped.
This is a fast-forward push. Never use `--force`. If git refuses the push, do NOT
force it — go to "If something goes wrong" below.

### Step 5 — Watch it go green

```
gh api repos/manmeet4954/client-tracker/commits/main/status --jq .state
```

Run it a few times over a minute or two. It goes `pending` then `success`. You can
also watch the Vercel dashboard. Tell Manmeet when it is live.

### Step 6 — Sync-back (usually nothing to do)

Because we always deploy FROM the vault's own main, the live app now matches the
vault automatically. There is nothing to copy back. The only exception: if you ever
made an emergency fix directly inside `/tmp/ct-deploy` instead of in the vault,
copy that fix back into the vault's `dashboard/` and merge it, or the next deploy
will silently undo it.

---

## If something goes wrong

- **The local build failed (Step 1).** Good — it failed here, not on the live site.
  The live app is untouched. Fix the code in the vault, merge, restart from Step 0.
- **The drift check showed real code (Step 2).** Stop and reconcile with Manmeet.
  Never graft over drift; that is exactly how the Assets tab got dropped once.
- **The push was refused (Step 4).** Someone or something moved the live repo since
  your last fetch. Run `git fetch client-tracker main` and redo Steps 2 and 4. Never
  force-push.
- **Vercel went red (Step 5).** The previous version is still live and serving; a
  failed build does not take the site down. Read the Vercel build log, fix the cause
  in the vault, and deploy again. Do not keep pushing hoping it passes.

---

## Why it is built this slightly odd way (context, not steps)

The vault used to deploy the dashboard by a git "subtree" trick. It broke and caused
hash mismatches. The graft-push above (take the dashboard tree, commit it onto the
live repo's head, fast-forward) replaced it and has been reliable since 2026-07-10.
The separate live repo exists because Vercel needs the app at a repo root, and the
vault keeps it in a subfolder. The drift check exists because on 2026-07-09 the two
repos silently disagreed and a blind deploy dropped live features. Every safety step
here is the scar of a real mistake, so keep them.

Deeper background lives in Claude's project memory (`project_client_dashboard.md`
and `dashboard-deploy-and-assets`). This file is the authoritative procedure; if
they ever disagree, trust this file and fix the memory.
