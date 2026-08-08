'use client';

// Intake → Curation. Restructure handoff, "Level 3 → INTAKE", and the
// prototype at docs/design-handoff/design/RoomsV3.dc.html.
//
// ONE PARAMETER AT A TIME. Two columns:
//   left   "What they said, kept"     #f4f1ee,  14px/1.6 #6b6570
//   right  "What it means, curated"   rgba(234,71,17,.07), label #b8551f
//   footer the Strategy parameter it feeds
//
// The two rules this screen exists to hold:
//
//   1. RAW ANSWERS ARE PERMANENT. The left column renders text and nothing
//      else. There is no edit control on a raw answer, at all, in any state.
//      Choosing which sources a value came from happens on the RIGHT, so the
//      left column never carries a control that could read as editing. A
//      document is raw material too and gets exactly the same treatment.
//   2. NO CURATED VALUE WITHOUT ITS PROVENANCE (spec 21 §7.4, S11): which
//      source produced it, who curated it, when, its confidence, and what it
//      superseded. All five are on screen, not in a tooltip.
//
// Spec 33 adds two things and rewrites nothing.
//
//   §3. The left column shows EVERY source for this parameter, typed answers
//       and documents together, each labelled with where it came from. Her
//       words were "studied the same way the questions are studied", so they
//       are one list and not a list with a documents box under it. A document
//       she has not tied to this parameter yet sits under "Also handed over",
//       where she can name it: a document never curates anything by itself.
//   §4 and §5. Back and Skip, beside the Next that was already here, using the
//       same three words the client's form uses so they mean the same three
//       things on both sides. Where am I, how do I go on, how do I go back,
//       and how do I leave without losing anything — all four, on the screen.
//
// Every count in every sentence is counted from the array it describes, in
// lib/intake/curationNav.ts. No number is typed into this file.

import { useMemo, useState } from 'react';
import {
  AlignLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Link2,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { Confidence } from '@/lib/tree/objects';
import { CurationRefused, curateParameter } from '@/lib/intake/curate';
import { markCurated } from '@/lib/intake/rounds';
import {
  CONFIDENCE_CHOICES, clientIdeas, composeCuration, curationQueue,
  nextParameter, shortDate,
  type AnswerLine, type CuratedReading, type CurationPanel, type QueueItem,
} from '@/lib/intake/screens';
import {
  composeSources, curationNav, openOn, provenanceLine, readDocuments,
  skipParameter, unskipParameter,
  type CurationNav, type CurationSource, type CurationSources,
} from '@/lib/intake/curationNav';

const RAW_BG = '#f4f1ee';
const CURATED_BG = 'rgba(234,71,17,.07)';

const GHOST_BUTTON =
  'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border '
  + 'border-[rgba(23,21,26,.14)] bg-white px-[15px] py-[9px] text-[13.5px] font-semibold '
  + 'text-text disabled:opacity-35';

export default function Curation({ clientId, body, ownerProfile }: {
  clientId: string;
  body: ProfileBody;
  /** One of hers. There is no client to answer, so she may write from her own note. */
  ownerProfile?: boolean;
}) {
  const { dispatch } = useApp();
  const [wanted, setWanted] = useState<string | null>(null);
  // Set aside, not abandoned: the third state, on her side of intake. Nothing
  // about the parameter is written or lost by it, so it lives with the screen.
  const [setAside, setSetAside] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const queue = useMemo(
    () => curationQueue(body, { includeUnanswered: ownerProfile === true }),
    [body, ownerProfile],
  );
  const currentId = openOn(queue, wanted, setAside);
  const panel = currentId ? composeCuration(body, currentId) : null;
  const documents = useMemo(() => readDocuments(body), [body]);
  const sources = useMemo(
    () => (currentId ? composeSources(body, currentId) : null),
    [body, currentId],
  );
  const nav = curationNav(queue, currentId, setAside);
  const ideas = clientIdeas(body);
  const next = nextParameter(queue, currentId);

  function goTo(id: string) {
    setWanted(id);
    setNote('');
  }

  function skip() {
    const after = skipParameter(queue, currentId, setAside);
    setSetAside(after.skipped);
    setWanted(after.currentId);
    setNote('');
  }

  function write(value: string, refs: string[], confidence: Confidence) {
    if (!panel) return;
    const now = new Date().toISOString();
    try {
      let updated = curateParameter(body, {
        parameter_id: panel.parameter.id, value, source_refs: refs,
        curator: 'owner', confidence, now,
      });
      updated = markCurated(updated, panel.parameter.id, now);
      dispatch({ type: 'SET_BODY', payload: { clientId, body: updated } });
      setNote('');
      // She came back to it and wrote it, so it is no longer set aside.
      setSetAside(v => unskipParameter(v, panel.parameter.id));
      if (next) setWanted(next);
    } catch (e) {
      setNote(e instanceof CurationRefused ? e.message : 'That could not be saved.');
    }
  }

  if (!panel || !sources) {
    return (
      <p className="rounded-card border border-hairline bg-white px-[18px] py-4 text-sm text-muted">
        Nothing has come back to curate yet. When an answer arrives it lands here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13.5px] leading-[1.55] text-muted">
        Their words are kept exactly as they arrived and can never be edited. Curating is the only
        way an answer becomes something the system uses.
      </p>

      <Picker queue={queue} currentId={panel.parameter.id} onPick={goTo} progress={nav.written} />

      <Nav nav={nav} onGo={goTo} onSkip={skip} />

      {nav.setAside.length > 0 && (
        <SetAside nav={nav} onGo={goTo} />
      )}

      {note && (
        <p className="rounded-2xl border border-[rgba(234,71,17,.3)] bg-white px-[18px] py-3 text-sm text-text">
          {note}
        </p>
      )}

      <Parameter
        panel={panel}
        sources={sources}
        documents={documents}
        onWrite={write}
        allowOwnerNote={ownerProfile === true}
      />

      {next && (
        <button
          type="button"
          onClick={() => goTo(next)}
          className="flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] px-[17px] py-[9px] text-[13.5px] font-semibold text-text"
        >
          Next one waiting
          <ChevronRight size={15} strokeWidth={2.2} />
        </button>
      )}

      {ideas.length > 0 && <Ideas ideas={ideas} />}
    </div>
  );
}

/** One parameter at a time, and the way to the others. */
function Picker({ queue, currentId, onPick, progress }: {
  queue: QueueItem[];
  currentId: string;
  onPick: (id: string) => void;
  progress: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentId}
        onChange={e => onPick(e.target.value)}
        className="min-w-[14rem] max-w-full flex-1 rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3.5 py-2.5 text-sm font-semibold text-text focus:border-accent focus:outline-none"
      >
        {queue.map(i => (
          <option key={i.id} value={i.id}>
            {i.label}{i.curated ? ', written' : i.waiting ? ', waiting on you' : ''}
          </option>
        ))}
      </select>
      <span className="whitespace-nowrap text-[12.5px] tabular-nums text-faint">{progress}</span>
    </div>
  );
}

/**
 * Spec 33 §5, answered here rather than described. Back, where she is, Skip
 * and Next — the same three words as the client's form, and the sentence that
 * says leaving costs nothing.
 */
function Nav({ nav, onGo, onSkip }: {
  nav: CurationNav;
  onGo: (id: string) => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-card border border-hairline bg-white p-2.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!nav.canBack}
          onClick={() => nav.backId && onGo(nav.backId)}
          className={`${GHOST_BUTTON} min-w-[92px] flex-1 sm:flex-none`}
        >
          <ChevronLeft size={15} strokeWidth={2.2} />
          Back
        </button>

        <span className="order-last w-full text-center text-[12.5px] tabular-nums text-faint sm:order-none sm:w-auto sm:flex-1">
          {nav.where}
        </span>

        <button
          type="button"
          disabled={!nav.canSkip}
          onClick={onSkip}
          className={`${GHOST_BUTTON} min-w-[92px] flex-1 sm:flex-none`}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={!nav.canNext}
          onClick={() => nav.nextId && onGo(nav.nextId)}
          className="flex min-w-[92px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-[15px] py-[9px] text-[13.5px] font-semibold text-white disabled:opacity-35 sm:flex-none"
        >
          Next
          <ChevronRight size={15} strokeWidth={2.2} />
        </button>
      </div>

      <p className="mt-2 mb-0 px-0.5 text-[11.5px] leading-[1.45] text-faint">
        {nav.currentSetAside ? 'You set this one aside. ' : ''}{nav.leaveLine}
      </p>
    </div>
  );
}

/** The ones she set aside, so "come back to this" is a real way back. */
function SetAside({ nav, onGo }: { nav: CurationNav; onGo: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] font-semibold text-muted">{nav.setAsideLine}</span>
      {nav.setAside.map(i => (
        <button
          key={i.id}
          type="button"
          onClick={() => onGo(i.id)}
          className="rounded-full border border-[rgba(23,21,26,.14)] bg-white px-3 py-[5px] text-[12px] font-semibold text-muted"
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

function Parameter({ panel, sources, documents, onWrite, allowOwnerNote }: {
  panel: CurationPanel;
  sources: CurationSources;
  documents: ReturnType<typeof readDocuments>;
  onWrite: (value: string, refs: string[], confidence: Confidence) => void;
  allowOwnerNote: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const writing = editing || !panel.current;
  const provenance = provenanceLine(panel.current, panel.superseded, documents);

  return (
    <section
      key={panel.parameter.id}
      className="rounded-card border border-hairline bg-white p-[18px] shadow-card"
    >
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
        {panel.parameter.label}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[210px] flex-1 rounded-[14px] p-3.5" style={{ background: RAW_BG }}>
          <div className="mb-1.5 text-[11.5px] font-semibold text-faint">What they said, kept</div>
          {sources.sources.length === 0
            ? <p className="m-0 text-sm leading-[1.6] text-muted">{sources.line}</p>
            : sources.sources.map(s => <Said key={s.ref} source={s} />)}
          {sources.sources.length > 0 && (
            <p className="mt-2.5 text-[11.5px] text-faint">{sources.line}</p>
          )}

          {sources.offered.length > 0 && <Offered sources={sources} />}
        </div>

        <div className="min-w-[210px] flex-1 rounded-[14px] p-3.5" style={{ background: CURATED_BG }}>
          <div className="mb-1.5 text-[11.5px] font-semibold text-accent-text">What it means, curated</div>

          {panel.current && (
            <>
              <p className="m-0 text-sm leading-[1.6] text-text">{panel.current.value}</p>
              <p className="mt-2 text-[11.5px] leading-[1.5] text-muted">{provenance}</p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-2.5 rounded-xl border border-[rgba(23,21,26,.14)] bg-white px-3.5 py-2 text-[13px] font-semibold text-text"
                >
                  Read it again
                </button>
              )}
            </>
          )}

          {writing && (
            <Write
              panel={panel}
              sources={sources}
              allowOwnerNote={allowOwnerNote}
              onWrite={(v, s, c) => { setEditing(false); onWrite(v, s, c); }}
              onCancel={panel.current ? () => setEditing(false) : undefined}
            />
          )}
        </div>
      </div>

      <div className="mt-3 text-[12.5px] text-faint">{panel.feedsLine}</div>

      {panel.superseded.length > 0 && <Superseded readings={panel.superseded} />}
    </section>
  );
}

const KIND_ICON = { file: FileText, link: Link2, text: AlignLeft } as const;

/**
 * One raw source: a typed answer, a refusal, or something they handed over.
 * Text, its label, and its meta line. No button, no input, no contentEditable
 * and no handler: the whole point is that this cannot be changed.
 *
 * The one anchor here opens a document in a new tab. It reads the material,
 * it does not touch it, which is the same right the text already has.
 */
function Said({ source }: { source: CurationSource }) {
  const doc = source.document;
  const Icon = doc ? KIND_ICON[doc.kind] : null;

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-faint">
        {Icon && <Icon size={12} strokeWidth={2.2} />}
        <span>{source.from}</span>
      </div>

      {source.text
        ? <p className="m-0 whitespace-pre-wrap text-sm leading-[1.6] text-muted">{source.text}</p>
        : <p className="m-0 text-sm leading-[1.6] text-muted">{source.note}</p>}

      <p className="mt-1 text-[11.5px] text-faint">{source.meta}</p>

      {doc?.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-text"
        >
          Open it
          <ExternalLink size={11} strokeWidth={2.2} />
        </a>
      )}
    </div>
  );
}

/**
 * §3: a document never curates anything by itself. Everything else they handed
 * over is listed here, tied to nothing, until she says it speaks to this one.
 * She says that on the RIGHT, by choosing it as a source, so this side stays
 * free of controls.
 */
function Offered({ sources }: { sources: CurationSources }) {
  return (
    <div className="mt-3 border-t border-[rgba(23,21,26,.09)] pt-2.5">
      <p className="m-0 text-[11.5px] leading-[1.45] text-faint">{sources.offeredLine}</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {sources.offered.map(s => {
          const Icon = s.document ? KIND_ICON[s.document.kind] : FileText;
          return (
            <li key={s.ref} className="flex items-start gap-1.5 text-[12.5px] leading-[1.45] text-muted">
              <Icon size={12} strokeWidth={2.2} className="mt-[3px] shrink-0" />
              <span>
                {s.from}
                {!s.readable && <span className="text-faint">, not read</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Write({ panel, sources, onWrite, onCancel, allowOwnerNote }: {
  panel: CurationPanel;
  sources: CurationSources;
  onWrite: (value: string, refs: string[], confidence: Confidence) => void;
  onCancel?: () => void;
  allowOwnerNote: boolean;
}) {
  const [value, setValue] = useState(panel.current?.value ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence>('confirmed');
  const [ownerNote, setOwnerNote] = useState('');

  // Everything she can name as the source: what they said, and what they
  // handed over — including what has not been tied to this parameter yet,
  // because choosing it here is exactly how it gets tied.
  const choices = [
    ...sources.sources.filter(s => s.kind !== 'skipped'),
    ...sources.offered,
  ];
  const refs = picked.length
    ? picked
    : ownerNote.trim() ? [`owner-direct:${ownerNote.trim()}`] : [];
  const ready = value.trim().length > 0 && refs.length > 0;

  return (
    <div className={panel.current ? 'mt-3 border-t border-[rgba(234,71,17,.18)] pt-3' : ''}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={3}
        placeholder="Write what it means, in your words"
        className="w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm leading-[1.6] text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />

      {choices.length > 0 && (
        <>
          <div className="mt-2.5 text-[11.5px] font-semibold text-muted">Which source this came from</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {choices.map(s => {
              const on = picked.includes(s.ref);
              return (
                <button
                  key={s.ref}
                  type="button"
                  onClick={() => setPicked(v => on ? v.filter(x => x !== s.ref) : [...v, s.ref])}
                  className={[
                    'max-w-full truncate rounded-full px-3 py-[5px] text-[12px] font-semibold',
                    on ? 'bg-ink text-white' : 'border border-[rgba(23,21,26,.14)] bg-white text-muted',
                  ].join(' ')}
                >
                  {s.from}
                  {s.kind === 'document' && !s.readable && ', not read'}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CONFIDENCE_CHOICES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setConfidence(c.id)}
            className={[
              'rounded-full px-3 py-[5px] text-[12px] font-semibold',
              confidence === c.id ? 'bg-ink text-white' : 'border border-[rgba(23,21,26,.14)] bg-white text-muted',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {picked.length === 0 && (choices.length === 0 || allowOwnerNote) && (
        <input
          value={ownerNote}
          onChange={e => setOwnerNote(e.target.value)}
          placeholder="Or say where this came from"
          className="mt-2.5 w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onWrite(value.trim(), refs, confidence)}
          className="rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-40"
        >
          {panel.current ? 'Write the new reading' : 'Write it'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-muted"
          >
            Leave it as it is
          </button>
        )}
      </div>

      {!ready && (
        <p className="mt-2 text-[11.5px] leading-[1.5] text-muted">
          Pick the source this came from, or say where it came from. Nothing is written without that.
        </p>
      )}
    </div>
  );
}

/** What it superseded. Nothing is overwritten, so every earlier reading stays. */
function Superseded({ readings }: { readings: CuratedReading[] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[12.5px] text-muted">
        {readings.length} earlier {readings.length === 1 ? 'reading' : 'readings'}, kept
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {readings.map((r, i) => (
          <li key={i} className="rounded-[14px] bg-sunken px-3.5 py-3">
            <p className="m-0 text-sm leading-[1.6] text-muted">{r.value}</p>
            <p className="mt-1 text-[11.5px] text-faint">
              {r.curator}, {shortDate(r.at)}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * §7.5 — the one lane that is not a fact about them. It becomes a seed in the
 * Engine, which is its one home, so this is a pointer and not a second copy.
 */
function Ideas({ ideas }: { ideas: AnswerLine[] }) {
  return (
    <section className="rounded-card border border-hairline bg-white p-[18px] shadow-card">
      <div className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
        Things they want us to talk about
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-muted">
        {ideas.length} of these came in with their answers. They are not facts about them, so nothing
        is curated here. You read them in the Engine and turn the ones worth it into seeds.
      </p>
    </section>
  );
}
