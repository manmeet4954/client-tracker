// The parameter inventory — spec 22 §4.
//
// Intake is HOW, never WHAT (PLAN §3.1). What we collect is defined HERE, by
// the parameters of context/personal-details and context/business-details, and
// every parameter carries its own question. Intake only gathers those
// questions, presents them, and brings the raw answers back.
//
// The inventory is UNIVERSAL, like the costume variables: the same for every
// profile, only the answers differ. So it is a code registry beside the tree
// registries (spec 22 §3.3), which is what lets the validator check it against
// the tree at build time.
//
// EVERY entry ships `vocabulary: 'draft'`. Her vocabulary pass flips a
// parameter to `hers`; until then a round carrying it cannot be SENT (§4 rule
// 1, §5.3, §16). She removes, Claude may add — the lists ship full and removal
// happens through use (PLAN §5.1 item 1).

/** §4.1 — the shapes a parameter's answer can take. */
export type ParameterShape =
  | 'text' | 'long-text' | 'number' | 'single-select' | 'multi-select'
  | 'list' | 'entry-list' | 'yes-no' | 'file-reference';

/** `draft` = still Claude's wording. `hers` = it survived her vocabulary pass. */
export type Vocabulary = 'draft' | 'hers';

/** `client` goes in a round; `owner-observed` she fills and never asks. */
export type AskedOf = 'client' | 'owner-observed';

export interface ParameterRecord {
  /** Stable. A round records ids, so rewording a question never breaks history. */
  id: string;
  /** The declared folder it belongs to. Under personal-details or
   *  business-details — the one exception is `client-ideas` (§7.5). */
  path: string;
  label: string;
  /** The words the client reads. Plain, hers, spoken. */
  question: string;
  shape: ParameterShape;
  /** The second half of a composite row ("text + multi-select"). */
  also?: ParameterShape;
  /** The columns of an entry-list. */
  fields?: string[];
  /** The finite word list this shape needs, by id (§4.7). */
  options?: string;
  /** Options that come from the profile rather than a fixed list — narrowed by
   *  the cascade, so a switched-off platform is never offered. */
  options_from?: 'platforms';
  /** Only asked while this platform is active for the profile (§5.3 step 3). */
  platform?: string;
  asked_of: AskedOf;
  /** Which strategy parameters cannot be derived without it (§8.1). */
  required_for: string[];
  /** §4.6's escape hatch: nothing in the derivation map reads it. */
  reader?: 'none-by-design';
  reader_reason?: string;
  vocabulary: Vocabulary;
  /** The spec 08 question it came from, or `new` where the tree names something
   *  spec 08 never asked. */
  spec08: string;
  /** §7.5 — the ONE lane whose curation target is not a detail folder. */
  curates_to?: string;
}

const PD = 'context/personal-details';
const BD = 'context/business-details';
const CS = 'context/content-strategy';

/** Everything under here is read by the engine's context bundle (PLAN §5.1)
 *  and by her, but no strategy parameter derives from it (§8.1). */
const BUNDLE_ONLY =
  'no strategy parameter derives from it; it feeds the engine context bundle (PLAN §5.1) and her reading of the client';

const P = (p: ParameterRecord): ParameterRecord => p;

export const PARAMETERS: ParameterRecord[] = [
  // ── personal-details / identity ────────────────────────────────────────────
  P({
    id: 'identity.name', path: `${PD}/identity`, label: 'Brand name',
    question: 'What name do you want this brand to carry?',
    shape: 'text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'identity.one-line', path: `${PD}/identity`, label: 'One line',
    question: 'How do you describe what you do, in one line?',
    shape: 'text', asked_of: 'client',
    required_for: [`${CS}/positioning`], vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'identity.working-week', path: `${PD}/identity`, label: 'A normal week',
    question: 'What does a normal working week actually look like for you?',
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'identity.credentials', path: `${PD}/identity`, label: 'Why you',
    question: 'What have you done that makes you worth listening to on this?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/positioning`], vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'identity.place-and-language', path: `${PD}/identity`, label: 'Place and language',
    question: 'Where are you based, and what language should the content be in?',
    shape: 'text', also: 'multi-select', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── personal-details / journey ─────────────────────────────────────────────
  P({
    id: 'journey.origin', path: `${PD}/journey`, label: 'The story',
    question: "What's the story only you can tell?",
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/positioning`], vocabulary: 'draft', spec08: 'Q11',
  }),
  P({
    id: 'journey.why', path: `${PD}/journey`, label: 'The why',
    question: 'Why did you start doing this, and why are you still doing it?',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/positioning`, `${CS}/pillars`], vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'journey.turning-points', path: `${PD}/journey`, label: 'Turning points',
    question: 'What are the two or three moments that changed how you work?',
    shape: 'list', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── personal-details / voice-of-the-person ─────────────────────────────────
  // RAW preference. content-strategy/voice is the DECIDED voice; the decision
  // happens at the derivation surface (§8), never here.
  P({
    id: 'voice.sounds-like', path: `${PD}/voice-of-the-person`, label: 'Sounds like',
    question: "Show me three accounts you'd be proud to sound like.",
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/voice`], vocabulary: 'draft', spec08: 'Q9a',
  }),
  P({
    id: 'voice.never-sounds-like', path: `${PD}/voice-of-the-person`, label: 'Never sounds like',
    question: "And one you'd hate to be compared to.",
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/voice`], vocabulary: 'draft', spec08: 'Q9b',
  }),
  P({
    id: 'voice.natural-tone', path: `${PD}/voice-of-the-person`, label: 'Natural tone',
    question: 'When you explain your work to a friend, how does it come out?',
    shape: 'multi-select', also: 'long-text', options: 'vibe-words', asked_of: 'client',
    required_for: [`${CS}/voice`], vocabulary: 'draft', spec08: 'Q9',
  }),
  P({
    id: 'voice.words-they-hate', path: `${PD}/voice-of-the-person`, label: 'Words they hate',
    question: 'Any words or phrases that make you cringe?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/voice`, `${CS}/boundaries`], vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'voice.pace', path: `${PD}/voice-of-the-person`, label: 'Pace',
    question: 'Do you like it short and sharp, or do you like to explain properly?',
    shape: 'single-select', options: 'pace', asked_of: 'client',
    required_for: [`${CS}/voice`], vocabulary: 'draft', spec08: 'new',
  }),

  // ── personal-details / ambitions ───────────────────────────────────────────
  // What they SAY they want. content-strategy/goals is what we will MEASURE,
  // with its S16 metric declaration. Never the same record.
  P({
    id: 'ambitions.six-months', path: `${PD}/ambitions`, label: 'Six months',
    question: 'Six months from now, what would make you say this worked?',
    shape: 'long-text', also: 'number', asked_of: 'client',
    required_for: [`${CS}/goals`, `${CS}/pillars/*/job`], vocabulary: 'draft', spec08: 'Q7',
  }),
  P({
    id: 'ambitions.known-or-sold', path: `${PD}/ambitions`, label: 'Known or sold',
    question: 'If you had to choose: more people knowing you, or more people buying, which one first?',
    shape: 'single-select', options: 'known-or-sold', asked_of: 'client',
    required_for: [`${CS}/pillars`, `${CS}/pillars/*/job`, `${CS}/pillars/*/mix-target`, `${CS}/goals`],
    vocabulary: 'draft', spec08: 'Q8',
  }),
  P({
    id: 'ambitions.proudest', path: `${PD}/ambitions`, label: 'Proudest',
    question: 'What are you proudest of so far?',
    shape: 'list', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'ambitions.three-years', path: `${PD}/ambitions`, label: 'Three years',
    question: 'Where do you want this to be in three years?',
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── personal-details / camera ──────────────────────────────────────────────
  P({
    id: 'camera.face', path: `${PD}/camera`, label: 'Face on camera',
    question: 'Will you show your face? How often, honestly?',
    shape: 'single-select', options: 'face-on-camera', asked_of: 'client',
    required_for: [`${CS}/platforms`, `${CS}/platforms/*/formats`], vocabulary: 'draft', spec08: 'Q10',
  }),
  P({
    id: 'camera.comfort', path: `${PD}/camera`, label: 'Filming comfort',
    question: 'What kind of filming feels fine, and what feels like too much?',
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'camera.voice-only', path: `${PD}/camera`, label: 'Heard but not seen',
    question: 'Are you okay being heard but not seen?',
    shape: 'yes-no', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── personal-details / history ─────────────────────────────────────────────
  P({
    id: 'history.wins', path: `${PD}/history`, label: 'Past wins',
    question: 'Which past post are you most proud of?',
    shape: 'list', fields: ['link', 'why'], asked_of: 'client',
    required_for: [`${CS}/proof-library`], vocabulary: 'draft', spec08: 'Q15a',
  }),
  P({
    id: 'history.flops', path: `${PD}/history`, label: 'Past flops',
    question: 'And which one embarrassed you?',
    shape: 'list', fields: ['link', 'why'], asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'Q15b',
  }),
  P({
    id: 'history.already-tried', path: `${PD}/history`, label: 'Already tried',
    question: "What have you already tried that didn't work?",
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── business-details / offers ──────────────────────────────────────────────
  P({
    id: 'offers.list', path: `${BD}/offers`, label: 'Offers',
    question: 'What do you sell?',
    shape: 'entry-list', fields: ['name', 'what it is', 'price band', 'type'],
    asked_of: 'client', required_for: [`${CS}/proof-library`], vocabulary: 'draft', spec08: 'Q1a',
  }),
  P({
    id: 'offers.hero', path: `${BD}/offers`, label: 'Hero offer',
    question: 'Which one thing pays the bills?',
    shape: 'single-select', asked_of: 'client',
    required_for: [`${CS}/positioning`, `${CS}/pillars`, `${CS}/goals`, `${CS}/ctas`],
    vocabulary: 'draft', spec08: 'Q1b',
  }),
  P({
    id: 'offers.in-their-words', path: `${BD}/offers`, label: 'In their words',
    question: "How do you describe it to someone who's never heard of it?",
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── business-details / buying-route ────────────────────────────────────────
  P({
    id: 'buying.last-sale', path: `${BD}/buying-route`, label: 'The last sale',
    question: 'Walk me through the last sale: where did that person come from, and what did they do right before paying?',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/funnel-shape`], vocabulary: 'draft', spec08: 'Q2',
  }),
  P({
    id: 'buying.where', path: `${BD}/buying-route`, label: 'Where money changes hands',
    question: 'Where does the money actually change hands?',
    shape: 'multi-select', options: 'buying-route', asked_of: 'client',
    required_for: [`${CS}/goals`, `${CS}/funnel-shape`, `${CS}/ctas`], vocabulary: 'draft', spec08: 'Q2b',
  }),
  P({
    id: 'buying.next-step', path: `${BD}/buying-route`, label: 'The next step',
    question: 'What should someone do the moment your content convinces them?',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/funnel-shape`, `${CS}/ctas`], vocabulary: 'draft', spec08: 'Q3',
  }),
  P({
    id: 'buying.attribution', path: `${BD}/buying-route`, label: 'Do they ask how',
    question: 'When a new customer shows up, do you ever ask how they found you? Could you start?',
    shape: 'single-select', options: 'attribution', asked_of: 'client',
    required_for: [`${CS}/funnel-shape`], vocabulary: 'draft', spec08: 'Q16',
  }),

  // ── business-details / market ──────────────────────────────────────────────
  P({
    id: 'market.industry', path: `${BD}/market`, label: 'Industry',
    question: 'What industry would someone put you in?',
    shape: 'text', asked_of: 'client', required_for: [],
    reader: 'none-by-design',
    reader_reason: 'no strategy parameter derives from it; market-research reads it (spec 21 §8.3) and PLAN §5.2 keeps that folder deliberately open',
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'market.usp', path: `${BD}/market`, label: 'What you do differently',
    question: "What do you do that the others in your space don't?",
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/positioning`, `${CS}/pillars`, `${CS}/proof-library`, `${CS}/boundaries`],
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'market.competitors', path: `${BD}/market`, label: 'Competitors',
    question: 'Who else would your customer be looking at?',
    shape: 'list', asked_of: 'client', required_for: [],
    reader: 'none-by-design',
    reader_reason: 'no strategy parameter derives from it; market-research reads it (spec 21 §8.3)',
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'market.shift', path: `${BD}/market`, label: "What's changing",
    question: "What's changing in your world right now?",
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design',
    reader_reason: 'no strategy parameter derives from it; market-research reads it (spec 21 §8.3)',
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── business-details / numbers ─────────────────────────────────────────────
  P({
    id: 'numbers.team-size', path: `${BD}/numbers`, label: 'Team size',
    question: 'How many people, including you?',
    shape: 'number', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'numbers.revenue-band', path: `${BD}/numbers`, label: 'Revenue band',
    question: 'Roughly what does the business do in a month?',
    shape: 'single-select', options: 'revenue-band', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'numbers.production', path: `${BD}/numbers`, label: 'Who shoots, how fast',
    question: 'Who takes the photos and videos, and how fast can you get me raw material?',
    shape: 'long-text', asked_of: 'client',
    required_for: [
      `${CS}/platforms`, `${CS}/platforms/*/formats`, `${CS}/cadence`,
      `${CS}/working-mode`, `${CS}/obligations`,
    ],
    vocabulary: 'draft', spec08: 'Q13',
  }),
  P({
    // A capacity FACT. content-strategy/cadence is the DECISION derived from it.
    id: 'numbers.sustainable-output', path: `${BD}/numbers`, label: 'Sustainable output',
    question: 'How many posts a week can you sustain on your worst week, not your best?',
    shape: 'number', asked_of: 'client',
    required_for: [`${CS}/cadence`], vocabulary: 'draft', spec08: 'Q12',
  }),

  // ── business-details / pains ───────────────────────────────────────────────
  P({
    id: 'pains.hardest-part', path: `${BD}/pains`, label: 'Hardest part',
    question: "What's the hardest part of the business right now?",
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'pains.content-blocker', path: `${BD}/pains`, label: 'Content blocker',
    question: "What's stopped you posting consistently before?",
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: BUNDLE_ONLY,
    vocabulary: 'draft', spec08: 'new',
  }),
  P({
    id: 'pains.growth-worry', path: `${BD}/pains`, label: 'Growth worry',
    question: 'What worries you about growing this?',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/boundaries`], vocabulary: 'draft', spec08: 'new',
  }),

  // ── business-details / audience-raw ────────────────────────────────────────
  P({
    id: 'audience.best-customer', path: `${BD}/audience-raw`, label: 'Best customer',
    question: 'Describe your best customer ever. Not the ideal one, a real one.',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/positioning`, `${CS}/audience-decided`], vocabulary: 'draft', spec08: 'Q4',
  }),
  P({
    id: 'audience.where', path: `${BD}/audience-raw`, label: 'Where they are',
    question: 'Where do they spend their time?',
    shape: 'long-text', also: 'multi-select', options_from: 'platforms', asked_of: 'client',
    required_for: [`${CS}/platforms`, `${CS}/audience-decided`], vocabulary: 'draft', spec08: 'Q4b',
  }),
  P({
    id: 'audience.search-words', path: `${BD}/audience-raw`, label: 'What they search',
    question: 'What do they type into Google or Instagram before finding you?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/audience-decided`], vocabulary: 'draft', spec08: 'Q5',
  }),
  P({
    id: 'audience.dm-words', path: `${BD}/audience-raw`, label: 'What they DM',
    question: 'What do they say when they DM you?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/voice`, `${CS}/audience-decided`], vocabulary: 'draft', spec08: 'Q6',
  }),
  P({
    id: 'audience.pain', path: `${BD}/audience-raw`, label: 'What they would pay to fix',
    question: 'What one to three problems would they pay to solve?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/pillars`, `${CS}/audience-decided`], vocabulary: 'draft',
    spec08: 'Q block B audiencePain',
  }),
  P({
    // The intake source of content-strategy/boundaries. PLAN §5.1 named the
    // unwanted audience as a boundary, and nothing collected it until now.
    id: 'audience.unwanted', path: `${BD}/audience-raw`, label: 'Unwanted audience',
    question: 'Who do you NOT want as a customer?',
    shape: 'long-text', asked_of: 'client',
    required_for: [`${CS}/boundaries`], vocabulary: 'draft', spec08: 'new',
  }),

  // ── business-details / materials (law-4 addition, spec 22 §12) ─────────────
  // Files never live in intake. A file handed over lands in work-log/assets/sets
  // through give-point 2 with its rights record (S21); materials records the
  // FACT and holds the reference.
  P({
    id: 'materials.brand-book', path: `${BD}/materials`, label: 'Brand book',
    question: 'Do you have a brand book?',
    shape: 'yes-no', also: 'file-reference', asked_of: 'client',
    required_for: [`${CS}/visual-branding`, `${CS}/obligations`], vocabulary: 'draft', spec08: 'Q14a',
  }),
  P({
    id: 'materials.logo-files', path: `${BD}/materials`, label: 'Logo files',
    question: 'Do you have logo files?',
    shape: 'yes-no', also: 'file-reference', asked_of: 'client',
    required_for: [`${CS}/visual-branding`, `${CS}/obligations`], vocabulary: 'draft', spec08: 'Q14b',
  }),
  P({
    id: 'materials.photo-bank', path: `${BD}/materials`, label: 'Photo and video bank',
    question: 'Do you have a photo or video bank we can pull from?',
    shape: 'yes-no', also: 'long-text', asked_of: 'client',
    required_for: [`${CS}/obligations`], vocabulary: 'draft', spec08: 'Q14c',
  }),
  P({
    id: 'materials.old-content', path: `${BD}/materials`, label: 'Old content that worked',
    question: 'Any old content that worked?',
    shape: 'list', asked_of: 'client',
    required_for: [`${CS}/obligations`], vocabulary: 'draft', spec08: 'Q14d',
  }),
  P({
    // This is what seeds work-log/creation/channels at strategy time, and the
    // direct answer to a question spec 21's ResumeGuru migration left open.
    id: 'materials.existing-accounts', path: `${BD}/materials`, label: 'Existing accounts',
    question: 'Which accounts do you already have, the handles, and who runs each one?',
    shape: 'entry-list', fields: ['platform', 'handle', 'who runs it'],
    options_from: 'platforms', asked_of: 'client',
    required_for: [`${CS}/platforms`, `${CS}/working-mode`, `${CS}/obligations`],
    vocabulary: 'draft', spec08: 'new',
  }),

  // ── §7.5 — the ONE lane that is not a context parameter ────────────────────
  // A client who brings ideas gives them at intake, not into the seed bank.
  // Spec 21's original client seed-input switch tried to let a client write
  // creation/topics and the validator refused it: S19 allows four doors, and
  // that would have been a fifth. The idea arrives through give-point 1; her
  // curation turns it into a seed, as owner.
  P({
    id: 'client-ideas', path: 'context/intake/answers', label: "The client's ideas",
    question: 'Anything you want us to talk about? Tell it however it comes out.',
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design',
    reader_reason: 'it is not a context parameter: she reads the idea and births a seed from it (§7.5)',
    vocabulary: 'draft', spec08: 'new',
    curates_to: 'work-log/creation/topics',
  }),
];

// ── §4.7 The vocabulary lists (all DRAFT — hers to pin) ──────────────────────
// Every list ships with a free-text lane, because a finite list that cannot be
// escaped produces false answers.

export interface VocabularyList {
  id: string;
  label: string;
  values: string[];
  /** False where the words are hers to write and nothing was drafted. */
  drafted: boolean;
  note?: string;
}

export const FREE_TEXT_LANE = 'Something else';

export const VOCABULARY_LISTS: VocabularyList[] = [
  { id: 'vibe-words', label: 'Vibe words', drafted: true,
    values: ['bold', 'warm', 'expert', 'playful', 'premium', 'honest', 'rebellious', 'calm', 'caring', 'direct'] },
  { id: 'pace', label: 'Pace', drafted: true,
    values: ['short and sharp', 'explains fully', 'mixed'] },
  { id: 'price-band', label: 'Price band', drafted: true, values: ['low', 'mid', 'premium'] },
  { id: 'offer-type', label: 'Offer type', drafted: true,
    values: ['product', 'service', 'course', 'template', 'booking', 'retainer'] },
  { id: 'buying-route', label: 'Buying route', drafted: true,
    values: ['website', 'DM chat', 'WhatsApp', 'call', 'in person', 'marketplace', 'form'] },
  { id: 'known-or-sold', label: 'Known or sold', drafted: true,
    values: ['more people knowing me first', 'more people buying first', "both, and here's the split"] },
  { id: 'face-on-camera', label: 'Face on camera', drafted: true, values: ['yes', 'sometimes', 'no'] },
  { id: 'attribution', label: 'Do they ask how', drafted: true, values: ['yes', 'no', 'could start'] },
  { id: 'revenue-band', label: 'Revenue band', drafted: false, values: [],
    note: 'not drafted, the words are hers' },
];

// ── Lookup ───────────────────────────────────────────────────────────────────

const BY_ID = new Map<string, ParameterRecord>();
for (const p of PARAMETERS) {
  if (BY_ID.has(p.id)) throw new Error(`[intake] duplicate parameter: ${p.id}`);
  BY_ID.set(p.id, p);
}

const LIST_BY_ID = new Map<string, VocabularyList>();
for (const l of VOCABULARY_LISTS) LIST_BY_ID.set(l.id, l);

export function findParameter(id: string): ParameterRecord | null {
  return BY_ID.get(id) ?? null;
}

export function findVocabularyList(id: string): VocabularyList | null {
  return LIST_BY_ID.get(id) ?? null;
}

/** Every parameter that belongs to one detail folder. */
export function parametersAt(path: string): ParameterRecord[] {
  return PARAMETERS.filter(p => p.path === path);
}

/** The detail folders the inventory actually fills, in tree order. */
export function parameterFolders(): string[] {
  const seen: string[] = [];
  for (const p of PARAMETERS) if (!seen.includes(p.path)) seen.push(p.path);
  return seen;
}

/** Parameters that go to a client in a round (§4.1 `asked_of`). */
export function askedOfClient(): ParameterRecord[] {
  return PARAMETERS.filter(p => p.asked_of === 'client');
}

/** True while any parameter in the set still carries Claude's wording. */
export function draftVocabulary(ids: string[]): ParameterRecord[] {
  return ids.map(findParameter).filter((p): p is ParameterRecord => !!p && p.vocabulary === 'draft');
}
