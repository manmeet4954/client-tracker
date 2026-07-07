// Starter answer pack for Divine Studio's Lead Answers tab.
// Content sourced from the studio's price sheets (July 2026). Prices live in
// these cards only — when Gautam changes a price, edit the card.
// Batch timings are deliberately NOT included in replies: they change often.

export interface SeedAnswer {
  category: string;
  question: string;
  reply: string;
  rule?: string;
}

export const DIVINE_LEAD_SEED: SeedAnswer[] = [
  {
    category: 'First message',
    question: 'Lead says hi or asks a vague question',
    reply:
      'Hi! Welcome to Divine Studio. So I can guide you right, may I ask:\n' +
      '1. Are you looking for gym, yoga, or both?\n' +
      '2. Which side are you on: Ambala City or Ambala Cantt?',
    rule: 'Always get these two answers before quoting any price. Gym prices are the same at both locations, but yoga prices differ by location.',
  },
  {
    category: 'Gym membership',
    question: 'What are the gym prices? (regular)',
    reply:
      'Here are our gym packages:\n' +
      'Monthly: Rs. 3,000\n' +
      '3 months: Rs. 7,500\n' +
      '6 months: Rs. 12,000\n' +
      '12 months: Rs. 20,000\n\n' +
      'We also have student and couple packages if either fits you.',
  },
  {
    category: 'Gym membership',
    question: 'Student package price?',
    reply:
      'Our student packages:\n' +
      'Monthly: Rs. 2,000\n' +
      '3 months: Rs. 5,000\n' +
      '6 months: Rs. 9,000\n' +
      '12 months: Rs. 13,000',
  },
  {
    category: 'Gym membership',
    question: 'Couple package price?',
    reply:
      'Our couple packages (for two people):\n' +
      'Monthly: Rs. 5,000\n' +
      '3 months: Rs. 13,000\n' +
      '6 months: Rs. 22,000\n' +
      '12 months: Rs. 32,000',
  },
  {
    category: 'Yoga',
    question: 'Yoga price in Ambala City?',
    reply:
      'For our Ambala City yoga batches:\n' +
      'Monthly: Rs. 5,000\n' +
      '3 months: Rs. 12,000\n\n' +
      'Classes run Monday to Friday. Want me to share the current batch timings?',
  },
  {
    category: 'Yoga',
    question: 'Yoga price in Ambala Cantt? (Silver / Gold)',
    reply:
      'For our Ambala Cantt yoga batches we have two options:\n\n' +
      'Silver package:\n' +
      'Monthly: Rs. 3,000\n' +
      '3 months: Rs. 7,500\n\n' +
      'Gold package (small groups, max 15, personal attention):\n' +
      'Monthly: Rs. 5,000\n' +
      '3 months: Rs. 12,000\n\n' +
      'Classes run Monday to Friday. Want me to share the current batch timings?',
  },
  {
    category: 'Yoga',
    question: 'Yoga for senior citizens?',
    reply:
      'Yes! We have a yoga package for senior citizens:\n' +
      'Monthly: Rs. 3,000\n' +
      '3 months: Rs. 7,500\n\n' +
      'It is a morning batch, available at both Ambala City and Ambala Cantt.',
  },
  {
    category: 'Gym + Yoga combo',
    question: 'Price if I want both gym and yoga?',
    reply:
      'We have a combined package that includes both gym and yoga:\n' +
      'Monthly: Rs. 7,000\n' +
      '3 months: Rs. 18,000\n' +
      '6 months: Rs. 30,000',
  },
  {
    category: 'Personal training',
    question: 'Personal training price?',
    reply:
      'Personal training (PT) ranges from Rs. 7,000 to Rs. 10,000 per month, depending on your goals and program. Tell me a little about what you want to achieve and we can guide you to the right option.',
    rule: 'Quote the range only. The exact PT price depends on the program, so confirm the final number with Gautam before committing to it.',
  },
  {
    category: 'Trial',
    question: 'Can I come for a trial?',
    reply:
      'Of course! We have a trial class for Rs. 300 (one class, gym or yoga). You take the class, see how it feels, and then decide. For couples the trial is Rs. 500. When would you like to come?',
  },
  {
    category: 'Timings & days',
    question: 'What are the timings? Which days are you open?',
    reply:
      'Yoga classes run Monday to Friday. The gym is open Monday to Saturday.\n\n' +
      'Tell me morning or evening and I will share the current batch options for your location.',
    rule: 'Batch timings change often, so they are not written in any reply. Check the current schedule before sharing timings, and update this card if the days change.',
  },
  {
    category: 'Location',
    question: 'Where are you located?',
    reply:
      'We have two locations:\n' +
      'Ambala City: Main Market, Sector 9\n' +
      'Ambala Cantt: Shree Hari Tower, behind SD Vidya School\n\n' +
      'Which one is closer to you?',
  },
];
