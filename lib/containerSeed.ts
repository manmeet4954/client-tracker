import { MapNode } from '@/types';

// The Container, laid out the way the system actually works: a numbered spine
// of stages (how a stranger becomes a client), each branching into the tasks
// that bring that stage to life. Every node carries a full `detail` brief so
// the map is self-contained — no need to open the wiki to remember anything.
// Mirrors "The Container — Build Plan" (2026-07-07/08).
// Seeded once into an empty map; after that Manmeet's edits own the data.

const T = new Date().toISOString();

let seq = 0;
function task(parentId: string, label: string, note: string, detail: string): MapNode {
  return {
    id: `cm-${parentId}-${++seq}`,
    parentId,
    label,
    note,
    detail,
    checkable: true,
    done: false,
    order: seq,
    createdAt: T,
  };
}

function stage(id: string, label: string, note: string, detail: string, color: string, order: number): MapNode {
  return { id, parentId: 'cm-root', label, note, detail, color, order, createdAt: T };
}

export function buildContainerSeed(): MapNode[] {
  const root: MapNode = {
    id: 'cm-root',
    label: 'The Container',
    note: 'How a stranger becomes a client inside my system',
    detail:
`The system a client enters when they hire me — so they are buying membership in my method, not renting my hands.

Why it exists:
· To be taken seriously (the structure carries the respect)
· To end machine-mode (the system absorbs the grind, I keep the parts I love)
· To make the price true (3-4 clients at ~₹1L each, not twenty at ₹20k)
· To survive bad weeks (the system runs even when I don't)

Read the map top to bottom — that is exactly the journey, stage by stage. Each stage branches into the tasks that bring it to life. Tick a task when it's built.`,
    order: 0,
    createdAt: T,
  };

  const s1 = stage('cm-entry', 'They find me', 'Referrals + LinkedIn → one booking link',
`What happens here:
A person hears about me from a referral (Merushri, Divine, Shiva's network) or finds me on LinkedIn — through my content, or my outreach to service-based founders.

The rule: every route converges on ONE booking link. Even a WhatsApp referral gets the Calendly link. Booking is never negotiated in chat — no "are you free Tuesday" back and forth, ever.

What this stage needs built: the Calendly with two event types, and the brief booking form inside it.`,
    '#8c52ff', 1);

  const s2 = stage('cm-intro', 'The Intro Call', 'Free, 15-20 min · fit + how I work',
`Free, 15-20 minutes. Its ONLY job: check fit, and explain how I work.

The script skeleton:
1. They talk first — I listen
2. My depth questions (see the script card)
3. I explain how I work: "step one is the Finding Session, here's the price and what you get"
4. The call ends one of exactly two ways: next step offered, or a polite no

The 24-hour rule: I NEVER say yes or no on the call itself. Every call ends with "I'll get back to you by tomorrow." The yes is the booking link. The no is the saved message.

My veto stands over money — see the disqualifier card.`,
    '#ff914d', 2);

  const s3 = stage('cm-finding', 'The Finding Session', 'Paid in advance · one sitting · recorded',
`The paid deep conversation — my real work starts here.

The rules:
· ₹1,500-2,000 (launch price — revisit only after the first 3 paid sessions)
· Paid fully IN ADVANCE, always. No payment, no session
· One sitting, recorded on Google Meet
· NOBODY skips it — a committed referral just does it as onboarding step one

How it ends, live on the call: thank you + a brief verbal rundown of what I'm seeing + the two doors:
"If you want to do it yourself, you can. If you want me alongside you, we get on a third meeting where I bring you the full picture."`,
    '#0ea5e9', 3);

  const s4 = stage('cm-conclusion', 'The Conclusion', 'Their document · both doors get it',
`Every session buyer receives this document — whichever door they choose.

What it is: who you are, the right positioning, the recommended path. Tight and honest — real value for their money, but NOT the brand book.

How it gets made (the conclusion flow):
recording → transcript → arranged into dots, patterns and their own words (intake tool + Claude) → MY core truth call → template filled.

No timers. The sequence is fixed, the speed is mine.`,
    '#22c55e', 4);

  const s5 = stage('cm-proposal', 'The Proposal', 'Present the depth · they take the offer',
`Only for door-two people — they already said "I want to work with you" out loud.

The meeting: I walk them through the full finding ON SCREEN — their dots, their core truth, the positioning, the direction. They feel the depth. It lands at:
"This is the package I'd put you on. This is the price. This is how working with me works."

The iron rule: PRESENT, don't hand over. They take away the offer, not the deep file. The full brand book is named as the first thing they receive after signing.

I prescribe — clients never negotiate. Their only decision is yes or no.
Yes → payment → onboarding. No → lead closed politely. A closed lead is a completed journey, not a failure.`,
    '#ec4899', 5);

  const s6 = stage('cm-onboarding', 'Onboarding', 'Payment → dashboard → brand book → briefing',
`The order, always:
1. Payment lands
2. Dashboard access — DAY ONE (their first experience of working with me is entering my system)
3. Brand book delivered
4. The briefing: how we work together
5. Creation starts

Month one begins from the brand book, never from improvisation. No silence after payment — silence right after paying is where doubt grows.`,
    '#eab308', 6);

  const s7 = stage('cm-month', 'The Month', 'One call · bulk creation · batch reviews',
`The diagnosis that fixed everything: the bulk problem and the feedback problem were ONE problem — no buffer. When creation day = review day = posting day, every change request is an emergency.

The rhythm:
1. Monthly strategy call (the ONE standing meeting)
2. The plan lands in the dashboard
3. Asset check — posts missing assets pause visibly (their item, not my stress)
4. Bulk creation block(s)
5. Client reviews in a BATCH, in the dashboard, with previews
6. Change rounds inside batch windows — no caps on rounds, but no racing deadlines either
7. Approved → scheduled (Sakshi)

Acknowledgment is split from execution: they hear "noted" instantly, the work happens in my next block. They feel served, my day stays mine.`,
    '#14b8a6', 7);

  const s8 = stage('cm-proof', 'The Proof', 'Words · movement · numbers — in that order',
`What the client sees that makes the retainer feel worth it. Three layers, smallest effort → hardest evidence:

1. WORDS — the perception check: what people are actually saying about them
2. MONEY — the attribution count: who came because of the content
3. NUMBERS — analytics in the dashboard: present, honest, and deliberately LAST on the page

Nothing in this stage depends on client discipline. The page layout itself argues my philosophy: trust over vanity metrics.`,
    '#f43f5e', 8);

  return [
    root,

    s1,
    task(s1.id, 'Calendly: two event types', 'Intro Call free · Finding Session paid',
`Set up Calendly with two event types:

1. Intro Call — free, 15-20 minutes, with the brief booking form attached (no form, no call)
2. Finding Session — paid, longer (60-90 min), booking allowed only after payment

Share ONLY this link everywhere: referrals, LinkedIn, WhatsApp. One door in.`),
    task(s1.id, 'Booking form questions', 'Brief on purpose — depth happens live',
`The questions on the booking form (short answers, just enough to prepare):

· What industry are you in?
· What kind of work do you do?
· What is your goal right now?
· Why are you reaching out?
· What do you need my help with?

Deep questions are NOT in the form. They belong to the Intro Call, live, where I can go one question deeper.`),

    s2,
    task(s2.id, 'Intro Call script card', 'The questions + the explanation + two endings',
`The questions I ask on every Intro Call:
· What is your goal?
· Have you done this before?
· What are you expecting?
· What are you NOT expecting?
· How comfortable are you facing the camera?
· …then one question deeper on whatever they reveal

Then the explanation, plainly: "Here's how I work. Step one is a Finding Session where we find your source of truth. It costs ₹X, and you get the conclusion document either way."

Ending A: "The next step is the Finding Session — I'll send you the link tomorrow."
Ending B: the polite no (saved message, sent within 24 hours).`),
    task(s2.id, 'Disqualifier card', 'Three reasons to say no — money never overrides',
`Say no when ANY of these is true:

1. They only want a social-media posting service (they need a content vendor, not a brand)
2. They will not face the camera
3. They don't align with what I define as personal branding

Keep this card in front of me on every call. Money does not override the veto — a wrong client at full price is still a wrong client.`),
    task(s2.id, 'Polite-no message', 'Written once, never improvised again',
`The saved message (edit the words once, then reuse forever):

"Thank you for the conversation. From what I understood, what I do isn't the right fit for what you need right now, and I don't take on work where I can't promise real value. I wish you the best with it."

Sent within 24 hours of the call. I never deliver a rejection live, and I never get talked into a client on a call.`),

    s3,
    task(s3.id, 'Payment link wired to booking', 'No payment, no session — enforced',
`A UPI / Razorpay payment link connected to the Finding Session booking.

The rule the system enforces: the session is booked only AFTER the payment lands. No exceptions, no "I'll pay after." This one rule ends free consumption of my deepest work.`),
    task(s3.id, 'Recorder tool picked + installed', 'One tool, every session',
`Pick ONE and install it once:
· Google Meet built-in recording
· tl;dv
· Fireflies

Every Finding Session gets recorded and transcribed. The transcript is what feeds the Conclusion — without it the conclusion flow has no input.`),
    task(s3.id, 'Drive folder structure per client', 'One home for everything',
`One Google Drive folder per client, created the day they book.
Fixed naming: "[Client Name] — Container"

Everything lands there: the recording, the transcript, their booking form answers, my notes. Later, the dashboard and the conclusion flow read from this folder. Decided once, never re-decided.`),
    task(s3.id, 'Pre-session prep checklist', 'The ~30 minute ritual',
`Before every Finding Session, the same ritual:

1. Reread the Intro Call notes
2. One pass through their social profiles
3. Frame my questions in advance

The session starts at depth, never at introductions. This half hour is what makes ₹2,000 feel like ₹20,000 to them.`),

    s4,
    task(s4.id, 'Transcript → conclusion flow card', 'The 5-step card',
`The five steps, same every time:

1. Session recording → transcript
2. Transcript into the intake tool / Claude
3. Out comes: their dots, patterns, contradictions, their own words grouped
4. I make the core truth call — never delegated, this is the part only I can do
5. Conclusion template filled and sent

The machine prepares; I judge.`),
    task(s4.id, 'Conclusion template', 'Fixed sections, filled per person',
`The document every session buyer receives. Fixed sections:

· What I heard
· Who you are (the source of truth)
· The right positioning
· The recommended path
· The two doors: implement it yourself, or do it with me

Tight, not the brand book. Their ₹1,500-2,000 deliverable — honest value even if they never sign.`),

    s5,
    task(s5.id, 'Proposal File template', 'Deep on diagnosis, zero execution',
`Fixed sections, assembled per person (assembly, not invention):

· Their dots — the life story points
· Core truth
· Positioning
· The direction + why it's right for THEM
· What working with me looks like
· The package + the price

Everything in it is about THEM (makes them feel found). Nothing in it is execution machinery (that's what they buy). Walked through on screen at the proposal meeting — the file itself stays mine until they sign.`),
    task(s5.id, 'Packages defined once', 'I prescribe · never per post',
`Define the packages once, prescribe from them forever.

The pricing logic (never break it):
· The brand system → one-time, premium
· Consistency → monthly retainer
· Moments (launches, campaigns) → per project
· NEVER per post — per post is where design stops being mine and becomes anyone's

Each package states: what's included, what's excluded, the client's obligations, the price, and whether posting is handled by us or by them. Prices are part of the system, not opinions — the client's only decision is yes or no.`),

    s6,
    task(s6.id, 'Day-one welcome kit', 'No silence after payment',
`What they receive the day payment lands:

· Dashboard login (they enter my system immediately)
· A short "here's what happens next" note
· Where to drop photos and videos (the asset norm starts on day one)

They just paid the biggest amount of the relationship — this kit is what fills the space where doubt would grow.`),
    task(s6.id, 'Onboarding briefing script', 'The conversation that sets the terms',
`The one conversation that sets how we work. It covers:

· Where we communicate: WhatsApp = human + notifications, the dashboard = the work
· Their obligations: photos, videos, approvals, the monthly call, showing up as agreed
· The teething paragraph, said in advance: "months 1-2 have high back-and-forth by design — that's us calibrating your voice. It settles."
· The asset drop norm: whenever you have photos/videos, drop them in — content is built from what exists

Said once on day one, this kills the over-explaining that used to eat months 1-3.`),
    task(s6.id, 'Brand book template finished', 'Verbal + visual + the skin sheet',
`The full machinery — delivered only after signing. Template is almost done, needs one refinement session.

Verbal side: positioning, brand value, core work personality, voice.
Visual side: colors, typography, mockups, samples so they SEE how it will look.

The skin sheet inside (so design stops being re-decided per post):
· One page margin
· Three gap sizes
· One type scale
· Two display fonts maximum
· Colors with jobs`),

    s7,
    task(s7.id, 'Profile optimization checklist', 'Always execution step one',
`For every new client, before any content:

· Bio rewritten
· Highlights set up
· Pinned posts chosen
· Whatever else the platform needs

Build the checklist once per platform, then run it every time instead of re-thinking it.`),
    task(s7.id, 'Monthly rhythm card', 'This card IS the month',
`The sequence that runs every month, printed and pinned:

Call → plan in dashboard → asset check → bulk creation → batch review with previews → changes in batches → Sakshi schedules

Bulk works when three things exist at month start: ideas (the call provides), assets (the drop norm provides), batched approval (the dashboard provides). My own proof: ResumeGuru bulk always worked; Divine worked in shoot months.`),
    task(s7.id, 'Saved acknowledgment reply', 'Heard instantly, done in the next batch',
`The saved reply for every change request:

"Noted — this goes into my next work block. You'll see the update in the dashboard."

They feel served immediately (my requirement). The work happens in my batch, not in their moment (my sanity). No revision caps — clients often can't know what they want until they see it — but no racing deadlines either.`),
    task(s7.id, 'Client obligations list', 'Their job, written and visible',
`What the client must give, written into the proposal AND the briefing:

· Photos and videos, dropped continuously into the system
· Approvals, in the dashboard, in batches
· The monthly strategy call
· Showing up on camera as agreed

A post missing assets pauses visibly as THEIR item. Chasing stops being my private stress.`),
    task(s7.id, 'Requests lane in dashboard', 'Ambushes become items',
`A visible lane for anything outside the agreed deliverables.

The move, every time: name it out loud as outside scope → park it in the lane → then schedule it or price it.

Special demands stop being ambushes and become items with a place.`),
    task(s7.id, 'Idea gate card per client', 'Pass or wait',
`An idea passes the gate or it waits. Two checks:

1. Does it fit one of this brand's pillars?
2. The signature checklist — passes at least 4 of 6:
   · One thing wins (a single anchor)
   · A receipt (something real shown, not claimed)
   · A hijack or twist (the format carries the idea)
   · Keyword ink (1-3 marked words, never more)
   · The frame (logo top, contact bottom)
   · Air (the confidence to leave space empty)

Print one per client.`),
    task(s7.id, 'AI-assist flow card', 'AI drafts · I filter · I pick',
`The standing loop for creation:

1. AI drafts from the brand's writing system (examples over rules)
2. I filter
3. I pick

The pick is NEVER delegated. AI amplifies what is clear — and the clarity is mine. If nothing is clear, it amplifies the blur.`),

    s8,
    task(s8.id, 'Perception check card', 'Three questions, every monthly call',
`The same three questions at every monthly strategy call:

1. Did anyone say anything about your page this month?
2. Was there a moment someone treated you differently because of your content?
3. Did any inquiry mention what you post?

I log the answers in the dashboard after the call. Zero client effort. Over months, the before/after story writes itself in their own words — Merushri's "everyone says the page is wholesome" was this, uncaptured.`),
    task(s8.id, 'Attribution question setup', 'The hard proof',
`During onboarding, help the client add ONE question wherever their leads arrive (DM auto-reply, booking form, walk-in ask):

"Where did you get to know about us?"

Simple tally, reviewed at the monthly call. Every "Instagram" answer is my work converting into their revenue, counted at the source. My conclusion, and the strongest layer of the proof page.`),
    task(s8.id, 'Analytics connection', 'Rohit-side plumbing, later',
`Basic numbers (reach, followers, engagement) pulled into the dashboard so clients never feel anything is hidden.

Deliberately LAST on the proof page — present and honest, but never the headline.

Rohit's side. Later. Blocks nothing.`),
  ];
}
