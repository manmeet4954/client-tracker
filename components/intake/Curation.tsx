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
//      Choosing which answers a value came from happens on the RIGHT, so the
//      left column never carries a control that could read as editing.
//   2. NO CURATED VALUE WITHOUT ITS PROVENANCE (spec 21 §7.4, S11): which
//      answer produced it, who curated it, when, its confidence, and what it
//      superseded. All five are on screen, not in a tooltip.

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { Confidence } from '@/lib/tree/objects';
import { CurationRefused, curateParameter } from '@/lib/intake/curate';
import { markCurated } from '@/lib/intake/rounds';
import {
  CONFIDENCE_CHOICES, clientIdeas, composeCuration, curationProgress, curationQueue,
  nextParameter, selectParameter, shortDate,
  type AnswerLine, type CuratedReading, type CurationPanel, type QueueItem,
} from '@/lib/intake/screens';

const RAW_BG = '#f4f1ee';
const CURATED_BG = 'rgba(234,71,17,.07)';

export default function Curation({ clientId, body, ownerProfile }: {
  clientId: string;
  body: ProfileBody;
  /** One of hers. There is no client to answer, so she may write from her own note. */
  ownerProfile?: boolean;
}) {
  const { dispatch } = useApp();
  const [wanted, setWanted] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const queue = useMemo(
    () => curationQueue(body, { includeUnanswered: ownerProfile === true }),
    [body, ownerProfile],
  );
  const currentId = selectParameter(queue, wanted);
  const panel = currentId ? composeCuration(body, currentId) : null;
  const progress = curationProgress(queue);
  const ideas = clientIdeas(body);
  const next = nextParameter(queue, currentId);

  function write(value: string, sources: string[], confidence: Confidence) {
    if (!panel) return;
    const now = new Date().toISOString();
    try {
      let updated = curateParameter(body, {
        parameter_id: panel.parameter.id, value, source_refs: sources,
        curator: 'owner', confidence, now,
      });
      updated = markCurated(updated, panel.parameter.id, now);
      dispatch({ type: 'SET_BODY', payload: { clientId, body: updated } });
      setNote('');
      if (next) setWanted(next);
    } catch (e) {
      setNote(e instanceof CurationRefused ? e.message : 'That could not be saved.');
    }
  }

  if (!panel) {
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

      <Picker queue={queue} currentId={panel.parameter.id} onPick={setWanted} progress={progress.line} />

      {note && (
        <p className="rounded-2xl border border-[rgba(234,71,17,.3)] bg-white px-[18px] py-3 text-sm text-text">
          {note}
        </p>
      )}

      <Parameter panel={panel} onWrite={write} allowOwnerNote={ownerProfile === true} />

      {next && (
        <button
          type="button"
          onClick={() => setWanted(next)}
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

function Parameter({ panel, onWrite, allowOwnerNote }: {
  panel: CurationPanel;
  onWrite: (value: string, sources: string[], confidence: Confidence) => void;
  allowOwnerNote: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const writing = editing || !panel.current;

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
          {panel.raw.length === 0
            ? <p className="m-0 text-sm leading-[1.6] text-muted">{panel.rawLine}</p>
            : panel.raw.map(a => <Said key={a.id} answer={a} />)}
          {panel.raw.length > 0 && (
            <p className="mt-2.5 text-[11.5px] text-faint">{panel.rawLine}</p>
          )}
        </div>

        <div className="min-w-[210px] flex-1 rounded-[14px] p-3.5" style={{ background: CURATED_BG }}>
          <div className="mb-1.5 text-[11.5px] font-semibold text-accent-text">What it means, curated</div>

          {panel.current && (
            <>
              <p className="m-0 text-sm leading-[1.6] text-text">{panel.current.value}</p>
              <p className="mt-2 text-[11.5px] leading-[1.5] text-muted">{panel.provenanceLine}</p>
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

/**
 * A raw answer. Text, and its meta line. No button, no input, no contentEditable
 * and no handler: the whole point is that this cannot be changed.
 */
function Said({ answer }: { answer: AnswerLine }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="m-0 text-sm leading-[1.6] text-muted">
        {answer.kind === 'skipped' ? 'They chose not to answer this.' : answer.value}
      </p>
      <p className="mt-1 text-[11.5px] text-faint">
        {answer.by}, round {answer.round}
        {answer.at ? `, ${shortDate(answer.at)}` : ''}
      </p>
    </div>
  );
}

function Write({ panel, onWrite, onCancel, allowOwnerNote }: {
  panel: CurationPanel;
  onWrite: (value: string, sources: string[], confidence: Confidence) => void;
  onCancel?: () => void;
  allowOwnerNote: boolean;
}) {
  const [value, setValue] = useState(panel.current?.value ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence>('confirmed');
  const [ownerNote, setOwnerNote] = useState('');

  const said = panel.raw.filter(a => a.kind === 'answer');
  const sources = picked.length
    ? picked
    : ownerNote.trim() ? [`owner-direct:${ownerNote.trim()}`] : [];
  const ready = value.trim().length > 0 && sources.length > 0;

  return (
    <div className={panel.current ? 'mt-3 border-t border-[rgba(234,71,17,.18)] pt-3' : ''}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={3}
        placeholder="Write what it means, in your words"
        className="w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm leading-[1.6] text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />

      {said.length > 0 && (
        <>
          <div className="mt-2.5 text-[11.5px] font-semibold text-muted">Which answer this came from</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {said.map((a, i) => {
              const on = picked.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPicked(v => on ? v.filter(x => x !== a.id) : [...v, a.id])}
                  className={[
                    'rounded-full px-3 py-[5px] text-[12px] font-semibold',
                    on ? 'bg-ink text-white' : 'border border-[rgba(23,21,26,.14)] bg-white text-muted',
                  ].join(' ')}
                >
                  Answer {i + 1}, round {a.round}
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

      {picked.length === 0 && (said.length === 0 || allowOwnerNote) && (
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
          onClick={() => onWrite(value.trim(), sources, confidence)}
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
          Pick the answer this came from, or say where it came from. Nothing is written without that.
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
