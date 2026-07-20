# WhatsApp Inbox — Manmeet's setup steps (Spec 18 part B)

The code is built and waiting. These are the steps only you can do, because
they need your Meta account and your phone. Budget about 45 minutes. Do them
in order. The bridge must already be deployed to the live dashboard before
step 5 works — ask Claude to deploy first if it isn't.

What you need before starting:
- The eSIM number, active, able to receive SMS.
- IMPORTANT: that number must NOT be registered in any WhatsApp app. If you
  ever opened WhatsApp with it, open that app and delete the account first
  (WhatsApp Settings → Account → Delete my account).

---

## Step 1 — open Meta for Developers

Go to developers.facebook.com and log in with the same Facebook account you
used for the Instagram tester invites. Open your app (or create one: My Apps
→ Create App → type "Business").

## Step 2 — add WhatsApp to the app

In the app dashboard, find "Add products" and add **WhatsApp**. It creates a
test setup automatically — ignore the test number it gives you; we use your
own.

## Step 3 — register the eSIM number

In WhatsApp → API Setup (or "Phone numbers"), choose **Add phone number**.
Enter the eSIM number, pick a display name like "KRNL Dashboard", and verify
it with the SMS code that arrives on the eSIM. When it's listed, copy the
**Phone number ID** shown under the number (a long digit string — this is
not the phone number itself). Save it in your notes.

## Step 4 — collect the three secret values

1. **Access token.** The token on the API Setup page expires in 24 hours —
   fine for today's test, but for the permanent one: Meta Business Suite →
   Business settings → Users → System users → Add (name it "dashboard",
   role Admin) → Generate token → pick your app → tick the
   `whatsapp_business_messaging` and `whatsapp_business_management`
   permissions → generate. Copy it once — it is never shown again.
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

App dashboard → WhatsApp → Configuration → Webhook → Edit:
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
