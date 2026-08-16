'use client';

// Intake, rebuilt — 2026-08-11.
//
// HER BRIEF, verbatim: "I am particularly annoyed with the intake section. I
// just don't want to keep it there, so rework around that. Make it simple
// instead of 'record this' or 'do that,' and have a proper UI/UX working: what
// will proceed where and by everything." And: "intake should store the
// information about how and what is needed."
//
// AMENDED THE SAME DAY, and this is the more important correction. The first
// build put the eight fact boxes on this page. Her verdict within the hour:
// "I am not able to understand that now you have changed the intake UI. The
// first thing you see is the positioning, audience, voice, pillars, cadence...
// when you go to strategy, the same questions again... the brand thing has that
// same thing again... Decide: same thing again." Asked to remove duplication, I
// had added a copy.
//
// So the line is drawn where she draws it: STRATEGY holds the brand's answers,
// ONCE, on The brand. INTAKE holds what ARRIVES from the client, and the asking
// that makes it arrive. The count and the gaps stay here because they are what
// is worth asking for; the boxes that hold the answers do not.
//
// So intake is no longer a PROCESS to be run. It is where a client's material
// comes in, and the gaps that are worth asking them about:
//
//   - The page is the facts, not a questionnaire. Every box is hers to type in,
//     at any time, in any order, whether or not anybody was ever asked.
//   - Information may arrive by ANY route and no route is privileged: she types
//     it, they send a document, or she sends them the blanks. All three land in
//     the same boxes. Her ruling on 2026-08-10: "questions are one route, not
//     the only route."
//   - Nothing is gated on it. A blank blocks nothing; the line at the top counts
//     and never scolds.
//
// WHAT WAS REMOVED, and why it is not a loss:
//   - "Rounds" and "Curation" — her words, 2026-08-10: "You have not understood
//     the terminologies." They were two screens for one thing. Asking now
//     happens in one place, on this page, and what comes back appears under the
//     box it answers.
//   - The 53-parameter bank as a route into her day. It still exists for the
//     engine and for old rounds; it is no longer the door she walks through.
//
// Old rounds are not deleted and not orphaned: Strategy → Intake history still
// renders them with the old screens, so nothing recorded before today is lost.

import { useRef, useState } from 'react';

import { useApp, useClient } from '@/contexts/AppContext';
import { Screen, ScreenHeader } from '@/components/shell/Screen';
import ProfileBodyGate from '@/components/ProfileBodyGate';
import Documents from './Documents';
import Library from './Library';
import FormBuilder from './FormBuilder';
import { factsKnown } from '@/lib/strategy/facts';
import FactRows, { GrowingText } from './FactRows';
import { FileText, Paperclip } from 'lucide-react';
import { addDocument, readDocuments } from '@/lib/intake/documents';
import { readSuggestions } from '@/lib/intake/suggestions';
import { formatMonthKey } from '@/lib/utils';
import type { ContentCard } from '@/types';
import {
  fileMeetingNote, openOwnQuestions, openOwnRound, readMeetingNotes, readOwnAnswers,
} from '@/lib/intake/ownQuestions';
import { generateId } from '@/lib/utils';
import { knownLine, gapNote } from '@/lib/intake/known';

/** The four features, each its own screen. Her structure, 2026-08-11. */
/**
 * REARRANGED 2026-08-11, on her third and sharpest note about this screen.
 *
 * "Questionnaire" and "Build a form" were two tabs that both asked questions,
 * which is the duplication she has spent all day cutting: "question is a
 * separate thing, and build a form is a separate thing, which is not needed at
 * all. Keep one build form." So there is ONE form. The eight standard brand
 * questions are prefills inside it, not a second feature beside it.
 *
 * And the FRONT of intake is the strategy taking shape, her design: "the first
 * thing here should be, instead of a questionnaire, a strategy which can
 * include a brief description about the client... when you start the intake,
 * the strategy keeps filling... the strategy feels like something that is
 * provable and something that is taking shape." The boxes on that front are
 * the same records the Strategy room reads, so this is a second VIEW of one
 * store, never a second copy: an answer arriving through the form appears
 * under its box here, and on The brand, at once.
 */
const INTAKE_TABS = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'form', label: 'Form' },
  { id: 'meetings', label: 'Meeting notes' },
  { id: 'uploads', label: 'Files' },
];

type IntakeTab = 'strategy' | 'form' | 'meetings' | 'uploads';

export default function Known({ clientId }: { clientId: string }) {
  const { role } = useApp();
  const { client, data } = useClient(clientId);
  const [tab, setTab] = useState<IntakeTab>('strategy');

  if (role !== 'owner') {
    return (
      <Screen>
        <ScreenHeader title="Intake" />
        <p className="text-sm text-muted">This screen is hers.</p>
      </Screen>
    );
  }

  if (!data.body) return <ProfileBodyGate clientId={clientId} />;

  const count = factsKnown(data);

  return (
    <Screen>
      <ScreenHeader
        title="Intake"
        segments={INTAKE_TABS}
        active={tab}
        onSelect={id => setTab(id as IntakeTab)}
      />
      <p className="-mt-1 text-[13px] leading-[1.6] text-muted">
        {knownLine(count)} {gapNote(count)}
      </p>

      {tab === 'strategy' && <StrategyFront clientId={clientId} />}
      {tab === 'form' && <FormBuilder clientId={clientId} name={client?.name ?? 'the client'} />}
      {tab === 'meetings' && <FromAMeeting clientId={clientId} name={client?.name ?? 'the client'} />}
      {tab === 'uploads' && (
        <>
          <Library clientId={clientId} />
          <TheySentSomething clientId={clientId} />
        </>
      )}
    </Screen>
  );
}

/*
 * `AskThem` LIVED HERE and is gone (2026-08-11). It was the "Client
 * questionnaire" card: chips for the eight blank facts and its own send button,
 * one tab away from the form builder that also asked questions. Her verdict:
 * "question is a separate thing, and build a form is a separate thing, which
 * is not needed at all. Keep one build form." The eight blanks are prefills in
 * the ONE form now ("Add the brand questions"), and their answers still land
 * under the brand boxes because the form carries each question's fact id.
 */

/**
 * The front of intake: the strategy, taking shape.
 *
 * A short description of who the client is, then the eight brand boxes. Blank
 * ones sit blank; answers arriving through the form appear under the box they
 * fill, with her one-tap accept. Nothing here is a copy: the description is
 * `brand.strategy` and the boxes are the same records the Strategy room reads.
 */
function StrategyFront({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const brand = data.brand;

  // Documents attached to the PROFILE itself (2026-08-11): "this client
  // profile section should also give me an option to add a pdf". They are
  // ordinary intake documents on the standing shelf, tagged as the profile's,
  // so they also appear in Files and open in the reader there. One store.
  const attached = data.body
    ? readDocuments(data.body, 0).filter(d => d.answers_parameter === PROFILE_DOC)
    : [];
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    if (!data.body) return;
    setUploading(true);
    setFailed('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'assets');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || 'upload failed');
      const { body: next } = addDocument(data.body, {
        round: 0,
        title: file.name,
        kind: 'file',
        url: json.url,
        mime: file.type,
        filename: file.name,
        given_by: 'owner',
        answers_parameter: PROFILE_DOC,
        now: new Date().toISOString(),
      });
      dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    } catch {
      setFailed('That file could not be uploaded. Nothing else was changed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-card border border-hairline bg-white p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold text-text">Client profile</span>
            <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-faint">
              What you know about them from your conversations. Recorded, never generated.
            </span>
          </span>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex flex-none items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-text disabled:opacity-50">
            <Paperclip size={14} strokeWidth={2.2} />
            {uploading ? 'Uploading' : 'Attach a PDF'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/*,.doc,.docx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ''; }} />

        <GrowingText
          value={brand.strategy || ''}
          onSave={v => dispatch({
            type: 'UPDATE_BRAND',
            payload: { clientId, brand: { ...brand, strategy: v } },
          })}
          placeholder="Who they are, what they do, what this engagement is for, and anything you have learned talking to them."
        />

        {failed && <p className="mt-1.5 text-[12.5px] font-semibold text-accent-text">{failed}</p>}

        {attached.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {attached.map(d => (
              <li key={d.id} className="flex items-center gap-2.5 rounded-xl bg-chip px-3 py-2.5">
                <FileText size={14} strokeWidth={2.1} className="flex-none text-muted" />
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text hover:text-accent">
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TheirSuggestions clientId={clientId} />

      <FactRows profileId={clientId} brandHref={`/profile/${clientId}/strategy/brand`} />
    </div>
  );
}

/**
 * Topics the client suggested, each one tap from being an Idea card.
 *
 * The suggestion arrives on the client-ideas lane (spec 22 §7.5); the tap
 * writes the same ContentCard every other add writes. Accepted ones keep
 * showing with a quieter face, because a record of what they asked for is
 * worth having when the month is planned.
 */
function TheirSuggestions({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const body = data.body;
  if (!body) return null;

  const suggestions = readSuggestions(body);
  if (suggestions.length === 0) return null;

  const cards = data.contentCards ?? [];
  const onBoard = (text: string) =>
    cards.some(c => c.title.trim().toLowerCase() === text.trim().toLowerCase());

  function toBoard(text: string) {
    const now = new Date().toISOString();
    const card: ContentCard = {
      id: generateId(), pillarId: '', title: text.trim(), hook: '', content: '', link: '',
      stage: 'idea', contentType: '', role: '', scheduledDate: '', postUrl: '', notes: '',
      customValues: {}, createdMonth: formatMonthKey(new Date()), createdAt: now, updatedAt: now,
    };
    dispatch({ type: 'ADD_CONTENT_CARD', payload: { clientId, card } });
  }

  return (
    <section className="rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[14.5px] font-semibold text-text">Topics they suggested</p>
      <ul className="mt-2 space-y-1.5">
        {suggestions.map(sug => {
          const taken = onBoard(sug.text);
          return (
            <li key={sug.id} className="flex items-center gap-3 rounded-xl bg-chip px-3 py-2.5">
              <span className={`min-w-0 flex-1 text-[13.5px] ${taken ? 'text-faint' : 'font-semibold text-text'}`}>
                {sug.text}
              </span>
              {taken ? (
                <span className="text-[12px] text-faint">On the board</span>
              ) : (
                <button type="button" onClick={() => toBoard(sug.text)}
                  className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
                  Add to board
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The tag that marks a document as the client profile's own attachment. */
const PROFILE_DOC = 'client-profile';

/*
 * `YourOwnQuestions` LIVED HERE and is gone (2026-08-11, same day it shipped).
 *
 * It was one textarea, one question per line, every question arriving as a box
 * to type in. Her brief the same afternoon was that a questionnaire should work
 * "like how we make it on Google Forms", and components/intake/FormBuilder is
 * that: question types, options, a preview, and the responses read back.
 *
 * Deleted rather than left beside it. A second way to ask a question is exactly
 * the duplication she has spent the day cutting out of this app.
 */

/**
 * What a meeting produced — restored, 2026-08-11.
 *
 * This existed. It lived only on the Rounds screen, and when Rounds came off
 * Intake this went with it. Her question the same afternoon ("or if I want to
 * add the meeting insights for the client") found the hole within hours. It is
 * a regression, and it is named as one in lib/intake/ownQuestions.ts.
 */
function FromAMeeting({ clientId, name }: { clientId: string; name: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [said, setSaid] = useState('');
  const [text, setText] = useState('');

  const body = data.body;
  if (!body) return null;
  const notes = readMeetingNotes(body);

  function file() {
    if (!body || !text.trim()) return;
    const next = fileMeetingNote(body, {
      title: title.trim() || `A call with ${name}`,
      text,
      said_by: said,
      now: new Date().toISOString(),
      id: generateId(),
    });
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    setTitle('');
    setSaid('');
    setText('');
    setOpen(false);
  }

  return (
    <section className="mt-3 rounded-card border border-hairline bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-text">Meeting notes</span>
          <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-faint">
            Notes and transcripts from calls, recorded against this client.
          </span>
        </span>
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="flex-none rounded-xl border border-hairline px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-text">
            Add
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={`Call with ${name}`}
              className="min-w-0 flex-1 rounded-xl border border-[rgba(23,21,26,.12)] px-3 py-2 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none" />
            <input value={said} onChange={e => setSaid(e.target.value)}
              placeholder="Attendee"
              className="min-w-0 rounded-xl border border-[rgba(23,21,26,.12)] px-3 py-2 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none sm:w-40" />
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus
            placeholder="Paste the transcript, or write up what was agreed."
            className="w-full resize-y rounded-xl border border-[rgba(23,21,26,.12)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-text placeholder:text-faint focus:border-accent focus:outline-none" />
          <div className="flex gap-2">
            <button type="button" onClick={file} disabled={!text.trim()}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
              Save note
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text">
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {notes.map(n => (
            <li key={n.id} className="rounded-xl bg-chip px-3 py-2.5">
              <p className="text-[13px] font-semibold text-text">{n.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-muted">{n.text}</p>
              <p className="mt-1 text-[11.5px] text-faint">{n.by}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


/** Client uploads: kept exactly as received, asked for or not. */
function TheySentSomething({ clientId }: { clientId: string }) {
  const { data } = useClient(clientId);
  const body = data.body;
  if (!body) return null;

  // Round 0 is the standing shelf: anything filed outside a form lives here,
  // which is what lets a document arrive before anybody was asked anything.
  return (
    <section className="mt-3 rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[14.5px] font-semibold text-text">Client uploads</p>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-faint">
        Decks, briefs, voice notes and links, stored exactly as received.
      </p>
      <div className="mt-2.5">
        <Documents clientId={clientId} body={body} round={0} defaultGivenBy="client" />
      </div>
    </section>
  );
}
