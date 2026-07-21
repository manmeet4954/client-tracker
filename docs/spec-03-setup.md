# Setup day - what you do by hand

The analytics core (specs 03 to 06) is BUILT AND LIVE on the
dashboard since 2026-07-17. It shows nothing until the steps
below are done. About 20 minutes in total.

Order: SQL, then the AI key, then the Instagram paperwork.

---

## Step 1: Run the SQL in Supabase (2 minutes)

This adds a few columns and two small tables. It never deletes
anything and is safe to run twice.

1. Open supabase.com and log in.
2. Open the dashboard project.
3. Click "SQL Editor" in the left menu.
4. Open the file `dashboard/supabase/SETUP-DAY.sql` on your Mac.
   (That is all three migrations in one paste. The originals are
   spec-03-link-join.sql, spec-05-account-insights.sql and
   spec-06-post-tags.sql if you ever want them separately.)
5. Copy everything in it, paste it into the SQL editor, press "Run".
6. It should say "Success". Done.

---

## Step 1b: Set the AI key in Vercel (2 minutes)

Without this the nightly reader never runs, and the Momentum
diary falls back to plain word matching.

1. Vercel, then the dashboard project.
2. Settings, then Environment Variables.
3. Add `ANTHROPIC_API_KEY` with your Anthropic key.
4. Deployments, then Redeploy the latest one so it loads.

Worth doing: set a spend limit in the Anthropic console. The
nightly tagger reads about 6 posts a run, so it is small, but a
limit is the honest guard.

---

## Step 2: Invite each Instagram account as a tester (5 minutes)

Same paperwork you did for ResumeGuru. Once per account:
Divine Studio, KRNL, your personal account, and any client
account whose login you hold. ResumeGuru is already done.

For each account:

1. Open developers.facebook.com and log in.
2. Open your existing app (the one used for ResumeGuru).
3. Go to "Instagram" then "API setup with Instagram login"
   (or "App roles" then "Roles", depending on the layout).
4. Add the account's Instagram username as an Instagram Tester.
5. Now log into that Instagram account (phone or web).
6. Go to Settings, then "Website permissions" or
   "Apps and websites", then "Tester invites".
7. Accept the invite.

---

## Step 3: Get a token and connect each account (5 minutes)

For each account, after its invite is accepted:

1. In the Meta app page, go to the Instagram API setup screen.
2. Under "Generate access tokens" find the account and press
   "Generate token". Log in as that account if it asks.
3. Copy the whole long token.
4. Open your dashboard. In the sidebar, tap "Connections"
   (it is under My Day, owner only).
5. Paste the token in "Connect a new account" and press Connect.
   The dashboard checks the token and saves it on the server.
   You will never see the token again. That is on purpose.
6. In the list above, use the dropdown next to the new account
   to pick which client it belongs to.

Also set the dropdown for ResumeGuru once, so its numbers are
tied to the right workspace.

---

## What happens after that

- Every night at 9 AM IST the sync pulls numbers for every
  connected account, not just ResumeGuru.
- Tokens refresh themselves. Nothing to renew by hand.
- When a content card has a live Instagram link in its
  "post url" field, the nightly run matches it to the fetched
  post. From then on the post's numbers belong to that card.
- Every week an account stays unconnected is history lost.
  The daily curves cannot be backfilled later.

## If something looks wrong

- A new account shows no numbers: they arrive with the next
  nightly run, so wait a day.
- "Instagram did not accept this token": the tester invite was
  not accepted yet, or the token was cut off while copying.
  Redo step 3 for that account.
