# WhatsApp Inbox — Manmeet's setup steps (Spec 18 part B)

## RESEARCH 2026-07-26 — Coexistence: a second door that skips the wall

She asked about "coexistence" — she remembered it as registering as a tech
support. Two different things, and the useful one is real.

**Coexistence is real and it dodges the exact step that killed the 07-20
attempt.** It lets one number run the WhatsApp Business APP and the Cloud API
at the same time. Onboarding is a **QR-code scan from inside the WhatsApp
Business app** (Settings → WhatsApp → sign up with Facebook, app version
2.24.17+). No SMS. No voice call. No 6-digit PIN registration. The whole
"Registration failed" dead end below does not exist on this path.

**"Tech Provider" is the wrong door.** That programme is for agencies who
onboard OTHER businesses' numbers (Wati, 360dialog, AiSensy). For her own
number she does not need it — she either runs her own Meta app, or lets an
existing provider do the onboarding and forwards their webhook.

What it costs her, on the record:
- The number must have been **actively used in the WhatsApp Business app for
  7+ days**, and must not already sit on a WhatsApp Business Account. **The
  eSIM +91 95186 00319 is currently attached to WABA 1346017167069849 in a
  Pending state** — it was never successfully registered, so deleting it
  should clear the way, but sources warn of a 1–2 month cooldown after a real
  WABA deletion. Unverified for a never-registered number.
- **No blue badge, ever.** Official Business Account is not supported on
  coexistence numbers.
- Broadcast lists are disabled, live location is off, disappearing messages
  are unsupported, and groups do not appear on the API side.
- App-sent messages stay free; API-sent messages bill at Cloud API rates.
- Messages she SENDS from the Business app are echoed to the webhook as
  `smb_message_echoes`. That is the mechanism that would let her type into a
  chat and have the dashboard read it — no second "Dashboard" contact needed.
- India is supported.

The decision this forces: coexistence works best on a number she ALREADY uses
in the WhatsApp Business app — which means her real working number, and every
client chat on it streaming to the dashboard webhook. That is a bigger
privacy call than the dead eSIM ever was. Hers to make.

**Separate and more urgent:** the "it just pasted my words in" complaint is
not a WhatsApp problem. `app/api/chat-brain/route.ts` returns
`{fallback:true}` with no `ANTHROPIC_API_KEY` set in Vercel — and it has
never been set. Fallback = the dumb hashtag rules, which take her raw words
as titles. Also `app/api/whatsapp/route.ts` still routes through the OLD v1
brain in `lib/whatsappInbox.ts`, not chat brain v4 — so connecting WhatsApp
today would deliver the dumb version regardless of the transport.

Order that follows: set the key → retest the chat → only then decide whether
WhatsApp is worth the coexistence tradeoffs.

## IN PROGRESS 2026-07-20 — stuck at number registration

CORRECTION to the first diagnosis below: she reports the eSIM works and can
send texts, so "the SIM is dead" is NOT established. Note the distinction —
sending from the number does not prove it can RECEIVE, and Meta must send a
code to it.

CONFIRMED: WhatsApp Manager → Phone numbers shows the number with status
**Pending**. That is ownership verification incomplete, and it is why the
PIN "Register" step fails — Meta will not register an unverified number, and
the error it gives ("Registration failed") never says so. They are two
different steps that both get called verify:
1. Ownership verification — Meta sends a code to the number.
2. Registration — the 6-digit PIN.

Dead end checked: the Two-step verification tab cannot help. Setting a PIN
there fails too ("The PIN could not be changed"), because PIN operations
also require a verified number — and the tab shows two-step is OFF, so no
old PIN was ever in the way.

The fix: WhatsApp Manager → Phone numbers → delete the pending number
(trash icon; safe — unregistered, unattached, zero data) → **Add phone
number** and enter it again. That flow insists on verification. Choose
VOICE CALL rather than SMS: a call lands on some connections where texts do
not, and it sidesteps the SMS question entirely. Only after the status reads
Connected will the app's Step 2 PIN registration work.

If errors appear instantly on retry, wait 20-30 minutes — this account threw
several "try again later" errors on 2026-07-20, which reads as new-developer
rate limiting rather than a broken setup.

CORRECTION (2026-07-20, learned the hard way): the Status column stays
**Pending** even after ownership verification succeeds — it flips to
Connected only when the final PIN registration goes through. So Pending
does not mean the code entry failed. Order: verify ownership (call + code)
→ Register with PIN → status becomes Connected. Also: SMS-vs-voice was a
red herring — Meta calls with the code either way.

After verification, if Register still errors: wait 30 minutes before one
retry (repeated attempts rate-limit this exact operation), then use the
error dialog's Contact support link if it persists.

Where it stopped: the number **+91 95186 00319** was added to the "myclients"
WhatsApp Business Account (WABA 1346017167069849, Phone Number ID
1181677055032911) under the My Pocket Resume portfolio, app "myclients"
(1036981885957003). Clicking **Register** fails with "Registration failed."
Diagnosis: a plain SMS sent to that number from her own phone never arrives,
so Meta cannot deliver the verification code. Registration cannot complete
until that is fixed.

Nothing is half-live and nothing is at risk: the webhook was never
configured, "Subscribe webhooks" is OFF, no payment method was added, and
the app is unpublished. The dashboard side is deployed and simply idle. The
abandoned first app ("mydash", under resumeguru.in) is inert too — never
subscribed to anything.

To resume, first get an SMS-capable number:
1. Check the eSIM has network at all in the phone, and that it is activated
   and recharged.
2. Ask the carrier why SMS is not arriving — common causes are a data-only
   plan, incomplete activation, or SMS not provisioned.
3. If it cannot be fixed, any other number that is NOT on WhatsApp works.
   Meta also offers voice-call verification, which some eSIMs accept even
   when SMS fails — worth trying before replacing the number.

Then continue from "Step 3 — register the eSIM number" below. Everything
before that is done.

Also still unresolved for later: the app must be PUBLISHED before real
messages reach the webhook (see the publishing note further down).

The code is built and waiting. These are the steps only you can do, because
they need your Meta account and your phone. Budget about 45 minutes. Do them
in order. The bridge must already be deployed to the live dashboard before
step 5 works — ask Claude to deploy first if it isn't.

## The one confusing word (read this first)

"WhatsApp Business Account" in the developer console is NOT the WhatsApp
Business app. Same name, different thing. It is a folder in Meta's console —
a name and an ID — that holds phone numbers. Creating one installs nothing
and needs no phone.

So the eSIM number never goes into any app on any phone. It lives on Meta's
servers. Her phone keeps running her normal WhatsApp and nothing else; she
saves the eSIM number as a contact called "Dashboard" and texts it like any
friend. There is no "one Business app per phone" limit to work around,
because no second app exists.

The eSIM needs to be in a phone exactly once — for the minute it takes to
receive the registration code. After that it can sit in a drawer; only keep
it recharged so the number stays alive.

Creating the folder does not trigger business verification. Verification is
Meta's gate for high volume and marketing sends; this bridge does neither.

What you need before starting:
- The eSIM number, active, able to receive SMS.
- IMPORTANT: that number must NOT be registered in any WhatsApp app. If you
  ever opened WhatsApp with it, open that app and delete the account first
  (WhatsApp Settings → Account → Delete my account).

---

## Step 0 — the portfolio (decided 2026-07-20)

NOT resumeguru.in. Its number is dormant today but WILL be used later, and
whoever activates it would then be working inside the same container as this
private bridge, able to change tokens, webhooks and subscriptions.

Her choice: the **My Pocket Resume** portfolio (she declined creating a
fresh KRNL one). Fine as long as Pocket Resume never runs WhatsApp itself —
if that changes, the eSIM's WhatsApp Business Account can be moved on its
own, so it is recoverable.

Whatever the portfolio: the phone number registered is ALWAYS the eSIM, and
if an existing WhatsApp number appears in the "From" dropdown, create a NEW
WhatsApp Business Account instead of using it.

An unverified portfolio is fine here: Meta's verification gates apply to
volume and business-initiated messaging, and this bridge does neither.

## Step 1 — open Meta for Developers

Go to developers.facebook.com and log in with the same Facebook account you
used for the Instagram tester invites. My Apps → Create App. On the form:
app name "krnl-dashboard" (internal, nobody sees it), your normal email, and
attach the **KRNL portfolio from step 0** — not resumeguru.in. On the
use-case screen: pick the option that mentions
**WhatsApp** ("Access the WhatsApp Business Platform") if it's listed;
if not, pick **"Other"** and then app type **"Business"**. Every other
field can stay default.

The business portfolio is required for WhatsApp (not optional). Use the KRNL
portfolio from step 0. The first attempt on 2026-07-20 used resumeguru.in
and hit the trap below — that app ("mydash") is abandoned, inert, and safe
to delete once the new one works; deleting an app never touches the WhatsApp
account beneath it. Cost note: WhatsApp only bills business-initiated
conversations; this bridge only ever replies to a message she just sent,
inside the free service window, so it costs nothing to run.

## Step 2 — open the WhatsApp section

The 2026 Meta flow already attached WhatsApp when the use case was picked —
there is no "Add products" step any more. On the app's **Use cases** page,
click **Customize** on the WhatsApp card. That opens a left menu with
Permissions and features / Quickstart / **API Setup** / **Configuration** /
Tech Provider onboarding / Resources. Everything below lives in API Setup
and Configuration.

IGNORE on these screens: "Become a Tech Provider" (that is for agencies
messaging on behalf of clients), the marketing-messages cards, and the "App
review" checklist — none are needed to message your own number.

## TRAP FOUND 2026-07-20 — the portfolio can drag in an existing account

Attaching a portfolio that already owns a WhatsApp Business Account makes
Meta auto-attach THAT account to the new app. On her run, API Setup opened
showing ResumeGuru's existing business number in the "From" dropdown, not
the eSIM.

Nothing breaks by itself: linking an app does not take over, disconnect, or
alter the existing number. But do NOT run the webhook step (step 6) while an
existing account is the attached one — subscribing is what would start
routing that number's messages to the dashboard.

The fix: give the eSIM its own WhatsApp Business Account. In the From
dropdown → Manage phone numbers / Add phone number → create a NEW WhatsApp
Business Account named "KRNL Dashboard" and register the eSIM under it. Then
subscribe the webhook to the KRNL account only. If Meta will not offer a new
account there, build the whole thing under its own fresh business portfolio
instead — more clicks, complete separation. Prefer the separate portfolio
outright if the existing number is live on another WhatsApp tool (Wati,
Interakt, AiSensy and the like).

Check before continuing: the "From" number must be the eSIM.

## TRAP 2 — the wrong "add your WhatsApp number" box

business.facebook.com → Business settings has a dialog titled "Add your
WhatsApp phone number" with a marketing-messages checkbox. That is Meta
asking for a number to SEND HER notifications and ads. It is not the API
registration. It rejects the eSIM with "Enter a valid WhatsApp phone
number" — correct behaviour, because it wants a number that already has
WhatsApp running, and the eSIM deliberately does not. Close it; leave it
empty; never tick the marketing box.

Registration happens ONLY in the developer console: developers.facebook.com
→ the app → Use cases → Customize → API Setup → "From" dropdown → Manage
phone numbers / Add phone number.

## Step 2 "Production setup" has three tasks — do them out of order

Meta lists: Configure Webhooks / Register your WhatsApp phone number / Add
payment. Correct order for us:

1. **Register your WhatsApp phone number** first (the eSIM) → gives the
   Phone number ID.
2. Permanent token + app secret.
3. Six values into Vercel, redeploy.
4. THEN Configure Webhooks — the callback URL and verify token. "Verify and
   save" makes Meta call the dashboard, so it fails unless the token is
   already live in Vercel. This is why the webhook box is filled last.
5. Subscribe to the **messages** field.

**Add payment: skip entirely.** It exists only for business-initiated
messages, which this bridge never sends. This is the zero-cost confirmation.

**PUBLISHING (found 2026-07-20):** Step 2 carries a warning that while the
app is unpublished, only test webhooks from the app dashboard are delivered
— no real messages, not even from admins. So the app must be PUBLISHED
before the bridge works. Publishing generally wants a privacy policy URL and
an app icon, and may want business verification. Unresolved until she gets
there; decide then whether to verify (Pocket Resume is a real business).

## Two versions of the same screen

Older apps show a left menu with **API Setup**. Newer ones show a guided
"Basic setup" checklist: Step 1 Try it out / Step 2 Production setup /
Step 3 Business verification. They are the same thing renamed.

In the guided version go straight to **Step 2. Production setup** — that is
where a real number is registered. Step 1 is only a demo with Meta's sandbox
number and can be skipped (do it only if Step 2 refuses to open without it).
Do not start Step 3 (business verification) on spec: try the registration
first, since verification is Meta's gate for volume and outbound marketing,
neither of which this bridge does.

## Step 3 — register the eSIM number

In WhatsApp → API Setup (or "Phone numbers"), choose **Add phone number**.
Enter the eSIM number, pick a display name like "KRNL Dashboard", and verify
it with the SMS code that arrives on the eSIM.

THE ONE CAREFUL MOMENT: a registration affects only the number typed into
this form. Type the eSIM number and double-check the digits before
submitting — never one of ResumeGuru's real numbers. Nothing else on the
portfolio (emails, admins, other numbers, Instagram) is touched or asked to
re-verify by this flow. If any screen ever asks about an EXISTING number or
email, stop and check with Claude first. Cost stays zero: replies within the
free service window only; skip any "add payment method" offer — it is only
for paid message types the dashboard never sends. When it's listed, copy the
**Phone number ID** shown under the number (a long digit string — this is
not the phone number itself). Save it in your notes.

## Step 4 — collect the three secret values

1. **Access token.** The token on the API Setup page expires in 24 hours, so
   do the permanent one now instead of redoing this tomorrow:
   business.facebook.com → Business settings (portfolio: resumeguru.in) →
   Users → System users → **Add** (name "dashboard", role Admin) → **Add
   assets** → Apps → pick the app → full control → **Generate new token** →
   app = your app, expiry **Never**, tick `whatsapp_business_messaging` and
   `whatsapp_business_management` → Generate. Copy it once — it is never
   shown again.
2. **App secret.** App dashboard → App settings → Basic → App secret → Show.
3. **Verify token.** This one you invent yourself: any random word/phrase,
   like a passcode. Write it down; you'll type it in two places.

## Step 5 — put the values in Vercel

Vercel → the dashboard project → Settings → Environment Variables. Add:

| Name | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | the token from step 4.1 |
| `WHATSAPP_APP_SECRET` | the app secret from step 4.2 |
| `WHATSAPP_VERIFY_TOKEN` | the word you invented in step 4.3 |
| `WHATSAPP_PHONE_NUMBER_ID` | the Phone number ID from step 3 |
| `WHATSAPP_OWNER_NUMBERS` | your own WhatsApp number(s), with country code, comma separated — e.g. `919876543210` or `919876543210,918888877777` |
| `ANTHROPIC_API_KEY` | the AI key (also owed for analytics — one key serves both) |

Then redeploy the project (Deployments → ⋯ on the latest → Redeploy) so the
new variables load.

Only numbers listed in `WHATSAPP_OWNER_NUMBERS` are heard. Everyone else who
texts the Dashboard number is ignored completely — no reply, nothing saved.

## Step 6 — point Meta's webhook at the dashboard

Use cases → Customize → **Configuration** (left menu) → Webhook → Edit:
- **Callback URL:** `https://YOUR-DASHBOARD-DOMAIN/api/whatsapp`
- **Verify token:** the word from step 4.3, exactly.
Save — it should verify instantly (green). Then under Webhook fields,
**Subscribe to `messages`**. Nothing else.

## Step 7 — save the contact and test

On your phone, save the eSIM number as a contact called **Dashboard**. Then
text it, one message at a time, and expect a reply within a few seconds:

| You send | Expected reply |
|---|---|
| `#task call the printer` | Added to My Day. |
| `#divine #task reschedule the reel` | Added to Divine Studio's agenda. |
| `#reels faces in second one hold longer` | Noted under Reels. |
| `people keep asking about pricing` | Noted under a fitting topic (AI picks; "Inbox" if no key). |
| a photo with caption `#divine` | Photo saved to Divine Studio's assets. |
| a photo with no caption | Whose photo is this? Send it again with a client tag... |

Then open the dashboard and check: My Day has the task, Divine's dashboard
has the agenda item, Observations has the notes, Divine's Assets has a
"WhatsApp" set with the photo.

Last check: ask someone else to text the Dashboard number from their phone.
They should get **no reply**, and nothing should appear anywhere.

## If something misbehaves

- Webhook won't verify (step 6): the verify token in Vercel and in Meta must
  match exactly, and the deploy must have finished after step 5.
- No replies: check `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
  were copied whole, then redeploy.
- Replies come but from the wrong understanding: screenshot the chat to
  Claude — the routing rules live in `lib/whatsappInbox.ts` and are easy to
  adjust.
