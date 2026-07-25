// A stand-in for the real blob, shaped like it.
//
// The migration and save-race tests need REAL-SHAPED data: a profile of hers
// (ResumeGuru — the pilot, per spec 21 §9.4: a client profile is never the
// experiment), a client profile beside it to prove nothing leaks, and a
// collaborator sharing a list. Values are representative, not her actual
// content — this machine has no access to the live database.

import type { AppState, ClientData } from '../types/index.ts';

function base(): ClientData {
  return {
    cards: [], customFields: [], monthData: {}, references: [],
    brand: { tagline: '', goals: [], strategy: '', audience: '', services: [] },
    brandKit: { colors: [], fonts: [] },
    postTarget: 0, evergreenIdeas: [], studioCompositions: [], coldCalls: [],
    onboarding: [], orders: [], catalogueCategories: [], catalogueItems: [],
    instagram: { handle: '', avatarUrl: '' }, previewPosts: [], pillars: [],
    pillarCards: [], assetSets: [], assetItems: [], driveFolderUrl: '',
    leadAnswers: [], contentCards: [], lists: [], listRows: [], topics: [],
  };
}

/** ResumeGuru — one of her own profiles, and the migration pilot. */
function resumeguru(): ClientData {
  return {
    ...base(),
    brand: {
      tagline: 'Careers, without the guesswork',
      goals: ['300 signups'],
      strategy: 'Teach the hiring system, then show the product doing it.',
      audience: 'Students and early-career people applying in India',
      services: [
        { id: 'svc-1', name: 'CareerOS', description: 'The resume and application workspace', price: '₹499' },
        { id: 'svc-2', name: 'Resume review', description: 'One-to-one review call', price: '₹999' },
      ],
    },
    brandKit: {
      colors: [{ id: 'c1', name: 'Guru Green', hex: '#25B763', role: 'Primary' }],
      fonts: [{ id: 'f1', name: 'Manrope', role: 'Headlines', weights: 'Regular, Bold' }],
      logos: [],
    },
    postTarget: 12,
    platforms: ['Instagram', 'LinkedIn'],
    instagram: { handle: 'resumeguru.ai', avatarUrl: 'https://example.test/avatar.jpg' },
    pillars: [
      { id: 'p-ai', name: 'AI for job hunting', color: '#25B763', job: 'reach', targetPct: 40, purpose: 'Bring new people in with tools they can use today', jobChangedAt: '2026-07-13T10:00:00.000Z', createdAt: '2026-05-01T10:00:00.000Z' },
      { id: 'p-trust', name: 'Interview truth', color: '#0284c7', job: 'trust', targetPct: 35, purpose: 'Show we actually know how hiring works', jobChangedAt: '2026-07-13T10:00:00.000Z', createdAt: '2026-05-01T10:00:00.000Z' },
      { id: 'p-convert', name: 'CareerOS', color: '#7c3aed', job: 'convert', targetPct: 25, purpose: 'Ask for the signup', createdAt: '2026-05-01T10:00:00.000Z' },
    ],
    topics: [
      { id: 't-salary', name: 'the salary question', createdAt: '2026-06-02T10:00:00.000Z' },
      { id: 't-ats', name: 'ATS myths', createdAt: '2026-06-11T10:00:00.000Z' },
    ],
    evergreenIdeas: [
      { id: 'ev-1', title: 'Resume mistakes that cost interviews', format: 'Carousel', notes: 'perennial', createdAt: '2026-05-20T10:00:00.000Z' },
    ],
    contentCards: [
      {
        id: 'card-salary', pillarId: 'p-trust', title: 'How to answer the salary question',
        hook: 'They ask it to anchor you, not to pay you', content: 'Slide 1 ...',
        stage: 'posted', contentType: 'Carousel', platform: 'Instagram',
        scheduledDate: '2026-07-08', postUrl: 'https://www.instagram.com/p/Cabc123/',
        notes: '', customValues: {}, createdMonth: '2026-07', topicId: 't-salary',
        role: 'value',
        createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-08T10:00:00.000Z',
      },
      {
        id: 'card-ats', pillarId: 'p-ai', title: 'ATS does not read your PDF the way you think',
        hook: 'Your resume is fine. The parser is not.', content: 'Reel script ...',
        stage: 'ready', contentType: 'Reel', platform: 'Instagram',
        scheduledDate: '', postUrl: '', notes: '', customValues: {}, createdMonth: '2026-07',
        topicId: 't-ats',
        experiment: { hypothesis: 'A reel of the same seed beats the carousel on reach' },
        createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z',
      },
      {
        id: 'card-os', pillarId: 'p-convert', title: 'What CareerOS actually does',
        hook: '', content: '', stage: 'idea', contentType: 'Static', platform: 'LinkedIn',
        scheduledDate: '', postUrl: '', notes: '', customValues: {}, createdMonth: '2026-07',
        createdAt: '2026-07-21T10:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z',
      },
    ],
    previewPosts: [
      {
        id: 'pv-1', shareId: 'abc123token', name: 'Salary carousel', postType: 'carousel',
        images: ['https://example.test/1.jpg', 'https://example.test/2.jpg'],
        caption: 'The salary question, answered.',
        createdAt: '2026-07-05T10:00:00.000Z', updatedAt: '2026-07-06T10:00:00.000Z',
      },
    ],
    references: [
      { id: 'ref-1', type: 'link', content: 'https://example.test/inspo', title: 'Layout we liked', pinned: true, createdAt: '2026-06-01T10:00:00.000Z' },
    ],
    assetSets: [{ id: 'set-1', name: 'July shoot', createdAt: '2026-07-02T10:00:00.000Z' }],
    assetItems: [
      { id: 'a-1', setId: 'set-1', url: 'https://example.test/a1.jpg', thumbUrl: 'https://example.test/a1t.webp', fileName: 'a1.jpg', size: 120000, uploadedBy: 'owner', createdAt: '2026-07-02T10:05:00.000Z' },
    ],
    driveFolderUrl: 'https://drive.example.test/resumeguru-videos',
    monthData: {
      '2026-07': { agenda: [{ id: 'ag-1', text: 'Book the July shoot', dueDate: '2026-07-02', done: true }] },
    },
    onboarding: [
      { id: 'ob-1', question: 'Who is this for?', answer: 'Students applying for their first real job' },
      { id: 'ob-2', question: 'What do you never want to say?', answer: 'Guaranteed placement' },
    ],
    coldCalls: [
      { id: 'cc-1', name: 'Placement cell, DU', phone: '+91...', location: 'Delhi', status: 'reached-out', response: 'Asked for a workshop deck', notes: '', createdAt: '2026-07-10T10:00:00.000Z' },
    ],
    lists: [
      { id: 'list-colleges', name: 'Colleges & Workshops', stages: [{ id: 's1', name: 'Not contacted' }, { id: 's2', name: 'Reached out' }], createdAt: '2026-06-20T10:00:00.000Z', sharedWith: [{ clientId: 'career-bubble', clientName: 'Career Bubble' }] },
    ],
    listRows: [
      { id: 'row-1', listId: 'list-colleges', stageId: 's2', name: 'DU North Campus', createdAt: '2026-06-21T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z' },
    ],
    journey: {
      northStar: 'Signups', targetValue: 300, targetDate: '2026-12', startMonth: '2026-05',
      checkIns: [{ month: '2026-06', value: 41 }, { month: '2026-07', value: 58 }],
      channels: [{ id: 'jc-1', name: 'Instagram', note: 'The only one running properly' }],
      nextSteps: 'Post more carousels, fix the link in bio',
    },
    momentum: {
      startDate: '2026-07-01', monthlyValue: 3000,
      entries: [{ date: '2026-07-24', actions: ['story', 'engaged'], note: 'replies all morning' }],
    },
    goals: ['links', 'conversations'],
  };
}

/** Divine Studio — a client profile, with the Lead Answers scripts. */
function divine(): ClientData {
  return {
    ...base(),
    platforms: ['Instagram'],
    instagram: { handle: 'divinestudio.in', avatarUrl: '' },
    postTarget: 8,
    pillars: [{ id: 'd-p1', name: 'Class life', color: '#10B981', job: 'reach', createdAt: '2026-06-01T10:00:00.000Z' }],
    leadAnswers: [
      { id: 'la-1', category: 'Yoga batch', question: 'What are the timings?', reply: 'Morning batches at 6 and 7:30, evening at 6.', rule: 'Never quote a discount without asking her first.', createdAt: '2026-06-05T10:00:00.000Z', updatedAt: '2026-06-05T10:00:00.000Z' },
    ],
    contentCards: [
      { id: 'd-card-1', pillarId: 'd-p1', title: 'Morning batch energy', hook: '', content: '', stage: 'scheduled', contentType: 'Reel', platform: 'Instagram', scheduledDate: '2026-07-28', postUrl: '', notes: '', customValues: {}, createdMonth: '2026-07', createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z' },
    ],
  };
}

/** Career Bubble — the profile Merushri's login is bound to. */
function careerBubble(): ClientData {
  return { ...base(), platforms: ['Instagram'] };
}

export function fixtureState(): AppState {
  return {
    clients: [
      { id: 'resumeguru', name: 'ResumeGuru', color: '#25B763', createdAt: '2026-05-01T10:00:00.000Z', ownerKind: 'hers' },
      { id: 'divine-studio', name: 'Divine Studio', color: '#10B981', createdAt: '2026-05-01T10:00:00.000Z' },
      { id: 'career-bubble', name: 'Career Bubble', color: '#8B5CF6', createdAt: '2026-05-01T10:00:00.000Z' },
    ],
    clientData: {
      resumeguru: resumeguru(),
      'divine-studio': divine(),
      'career-bubble': careerBubble(),
    },
    personalTasks: [
      { id: 't-1', text: 'Buy groceries', bucket: 'today', taskType: 'personal', clientIds: [], done: false, createdAt: '2026-07-24T10:00:00.000Z' },
    ],
    brainDump: { nodes: [], edges: [] },
    containerMap: { nodes: [] },
    observations: [
      { id: 'ob-tagged', topic: 'Reels', text: 'Reels with faces hold longer', clientId: 'resumeguru', createdAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z' },
      { id: 'ob-untagged', topic: 'Inbox', text: 'Think about the pricing page', createdAt: '2026-07-21T10:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z' },
    ],
    chatLog: [
      { id: 'm-1', who: 'me', text: 'add a divine reel for friday', createdAt: '2026-07-22T10:00:00.000Z' },
      { id: 'm-2', who: 'dash', text: 'Done — card added to Divine Studio', ok: true, createdAt: '2026-07-22T10:00:01.000Z' },
    ],
    bindings: [
      { role: 'merushri', profileId: 'career-bubble', kind: 'client', createdAt: '2026-07-25T10:00:00.000Z' },
      { role: 'intern', profileId: 'divine-studio', kind: 'staff', createdAt: '2026-07-25T10:00:00.000Z' },
      { role: 'intern', profileId: 'resumeguru', kind: 'staff', createdAt: '2026-07-25T10:00:00.000Z' },
    ],
  };
}
