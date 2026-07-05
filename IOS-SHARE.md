# iOS Share Setup (Apple Shortcut)

Android phones get the share sheet for free: install the dashboard as an app and it appears in the share menu (Web Share Target). Apple does not support that on iPhone, so on iOS we use an Apple Shortcut instead. Once set up, it works exactly the same way: watch a reel, tap Share, tap the shortcut, done. The link lands in the References tab.

## One-time setup on the iPhone

1. Open the **Shortcuts** app (pre-installed on every iPhone).
2. Tap **+** to create a new shortcut. Name it **Save to My Clients**.
3. Tap the info button (i) at the bottom, turn on **Show in Share Sheet**. Under "Share Sheet Types" keep **URLs** and **Text**.
4. Add the action **Get Contents of URL** and configure it:
   - URL: `https://client-tracker-rose.vercel.app/api/share`
   - Method: **POST**
   - Request Body: **JSON**, with these fields:
     - `url` (Text) = the **Shortcut Input** variable
     - `passcode` (Text) = the person's login passcode (same one they use to open the dashboard)
     - `client` (Text, optional) = client name, e.g. `Divine` — only needed for logins that can see more than one client. Client logins (Shiva, Merushri) and Mom can leave this out; it auto-saves to their own workspace.
5. Optional: add a **Show Notification** action after it, so they get a "Saved" ping.
6. Done. Now in Instagram or YouTube: Share → scroll the share sheet → **Save to My Clients**.

## How auth works

`/api/share` accepts either the normal login cookie (Android PWA flow) or a `passcode` field in the JSON body (iOS Shortcut flow, since Shortcuts cannot send our cookie). The passcode maps to the same role as the login screen, so each person's shortcut can only ever save into the clients that person is allowed to see.
