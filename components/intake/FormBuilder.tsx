'use client';

// Intake → Questionnaire. The builder, 2026-08-11.
//
// HER BRIEF: "it should work like a proper questionnaire works, like how we
// make it on Google Forms." So the three things that makes: BUILD it, LOOK at
// it the way the client will, and READ what came back.
//
// Three tabs, and the third one is the one that earns its keep. A form you can
// build and send but not read the answers to is a mailing list.
//
// It refuses rather than repairs. A "choose one" question with no options is
// unanswerable, so the send button says so and stays off, instead of quietly
// turning it into a text box and letting her find out from a client.
//
// The preview renders from the SAME question records the client will receive,
// not from the drafts on screen, once a form is out. A preview drawn from
// something other than what was sent is a lie with good intentions.

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import {
  QUESTION_TYPES, blankQuestion, canSend, findType, formProblems, formResponses,
  liveForm, moveQuestion, openBuiltForm, responsesLine, typeNeedsOptions,
  type FormQuestion, type QuestionDraft,
} from '@/lib/intake/formBuilder';
import { FACT_ASKS, askableBlanks, type FactName } from '@/lib/intake/factsRound';
import { fileAnswer } from '@/lib/intake/rounds';
import { factsKnown } from '@/lib/strategy/facts';

const TABS = [
  { id: 'build', label: 'Build' },
  { id: 'preview', label: 'Preview' },
  { id: 'responses', label: 'Responses' },
];

export default function FormBuilder({ clientId, name }: { clientId: string; name: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [tab, setTab] = useState('build');
  const [drafts, setDrafts] = useState<QuestionDraft[]>([blankQuestion(generateId())]);
  const [copied, setCopied] = useState(false);

  const body = data.body;
  if (!body) return null;

  const live = liveForm(body);
  const responses = formResponses(body);
  const problems = formProblems(drafts);

  function send() {
    if (!body || !canSend(drafts)) return;
    const { body: next } = openBuiltForm(body, drafts, new Date().toISOString());
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    setDrafts([blankQuestion(generateId())]);
    copyLink();
    setTab('preview');
  }

  function copyLink() {
    const href = `${window.location.origin}/profile/${clientId}/intake`;
    navigator.clipboard?.writeText(href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="rounded-card border border-hairline bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex gap-1 rounded-[10px] bg-chip p-1">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
                t.id === tab ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
              }`}>
              {t.label}
              {t.id === 'responses' && responses.length > 0 && (
                <span className="tnum ml-1.5 text-faint">
                  {responses.filter(r => r.answer !== null).length}/{responses.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {live && (
          <button type="button" onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-text">
            {copied ? <Check size={14} strokeWidth={2.3} /> : <Copy size={14} strokeWidth={2.2} />}
            {copied ? 'Copied' : 'Client link'}
          </button>
        )}
      </div>

      <div className="p-4">
        {tab === 'build' && (
          <Build
            drafts={drafts}
            setDrafts={setDrafts}
            problems={problems}
            onSend={send}
            live={!!live}
            name={name}
            blanks={askableBlanks(factsKnown(data))}
          />
        )}
        {tab === 'preview' && <Preview questions={live?.questions ?? draftsAsQuestions(drafts)} sent={!!live} />}
        {tab === 'responses' && <Responses />}
      </div>
    </section>
  );

  function recordAnswer(parameterId: string, value: string) {
    if (!body || !live || !value.trim()) return;
    // Her side of "or the client can add answers": an answer she types lands in
    // the same records a client's would, marked as recorded by her, so a phone
    // call or a WhatsApp reply is not second-class data.
    const next = fileAnswer(body, {
      round: live.version,
      parameter_id: parameterId,
      value: value.trim(),
      by: 'owner',
      source: 'owner-recorded',
      now: new Date().toISOString(),
    });
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
  }

  function Responses() {
    if (responses.length === 0) {
      return <p className="text-[13px] text-faint">Nothing has been sent to {name} yet.</p>;
    }
    return (
      <>
        <p className="tnum mb-3 text-[13.5px] font-semibold text-text">{responsesLine(responses)}</p>
        <ol className="space-y-2">
          {responses.map(r => (
            <li key={r.parameterId} className="rounded-xl bg-chip px-3.5 py-3">
              <p className="text-[13px] font-semibold text-text">{r.text}</p>
              {r.answer !== null ? (
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.55] text-text">{r.answer}</p>
              ) : (
                // Silence is shown, never hidden, and she can fill it herself:
                // an answer from a call or a chat is typed here and stored like
                // any other.
                <AnswerBox
                  skipped={r.skipped}
                  onSave={value => recordAnswer(r.parameterId, value)}
                />
              )}
            </li>
          ))}
        </ol>
      </>
    );
  }
}

/** What the client sees, drawn from drafts before sending and from the stored
 *  questions after, so a preview is never a flattering guess. */
function draftsAsQuestions(drafts: QuestionDraft[]): FormQuestion[] {
  return drafts
    .filter(d => d.text.trim())
    .map((d, i) => ({
      parameterId: d.key, text: d.text.trim(), shape: d.shape,
      options: d.options.map(o => o.trim()).filter(Boolean), order: i,
    }));
}

function Build({ drafts, setDrafts, problems, onSend, live, name, blanks }: {
  drafts: QuestionDraft[];
  setDrafts: (d: QuestionDraft[]) => void;
  problems: string[];
  onSend: () => void;
  live: boolean;
  name: string;
  /** Brand facts still blank on this profile, offered as ready-made questions. */
  blanks: FactName[];
}) {
  function patch(i: number, change: Partial<QuestionDraft>) {
    setDrafts(drafts.map((d, n) => (n === i ? { ...d, ...change } : d)));
  }

  // The eight standard questions used to be their own tab beside this one, two
  // screens both asking questions. They are prefills of the ONE form now, and
  // their answers land under the brand boxes, so the strategy fills as intake
  // happens. Facts already in the form are not offered twice.
  const offered = blanks.filter(f => !drafts.some(d => d.factId === f));
  function addBrandQuestions() {
    const fresh = offered.map(f => ({
      ...blankQuestion(generateId()),
      text: FACT_ASKS[f].question,
      factId: f,
    }));
    const keep = drafts.filter(d => d.text.trim());
    setDrafts([...keep, ...fresh]);
  }

  return (
    <>
      {live && (
        <p className="mb-3 text-[12.5px] leading-[1.5] text-muted">
          A questionnaire is already out with {name}. Sending a new one replaces it, and the
          answers to the old one are kept.
        </p>
      )}

      <ol className="space-y-2">
        {drafts.map((d, i) => {
          const type = findType(d.shape);
          return (
            <li key={d.key} className="rounded-xl border border-hairline p-3">
              <div className="flex items-start gap-2">
                <span className="tnum mt-2.5 w-5 flex-none text-[12px] font-semibold text-faint">{i + 1}</span>
                <input
                  value={d.text}
                  onChange={e => patch(i, { text: e.target.value })}
                  placeholder="Ask them something"
                  className="min-w-0 flex-1 rounded-lg border border-[rgba(23,21,26,.12)] px-3 py-2 text-[14px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <div className="flex flex-none items-center gap-0.5">
                  <button type="button" aria-label="Move up" onClick={() => setDrafts(moveQuestion(drafts, i, -1))}
                    className="flex h-8 w-7 items-center justify-center rounded-lg text-faint hover:text-text">
                    <ChevronUp size={15} strokeWidth={2.2} />
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => setDrafts(moveQuestion(drafts, i, 1))}
                    className="flex h-8 w-7 items-center justify-center rounded-lg text-faint hover:text-text">
                    <ChevronDown size={15} strokeWidth={2.2} />
                  </button>
                  <button type="button" aria-label="Remove question"
                    onClick={() => setDrafts(drafts.filter((_, n) => n !== i))}
                    className="flex h-8 w-7 items-center justify-center rounded-lg text-faint hover:text-accent-text">
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                <select
                  value={d.shape}
                  onChange={e => patch(i, { shape: e.target.value as QuestionDraft['shape'] })}
                  aria-label={`Answer type for question ${i + 1}`}
                  className="rounded-lg border border-[rgba(23,21,26,.12)] px-2.5 py-1.5 text-[12.5px] text-text focus:border-accent focus:outline-none"
                >
                  {QUESTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span className="text-[12px] text-faint">{type?.hint}</span>
                {d.factId && (
                  <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-muted">
                    Fills {d.factId}
                  </span>
                )}
              </div>

              {typeNeedsOptions(d.shape) && (
                <div className="mt-2 pl-7">
                  <textarea
                    value={d.options.join('\n')}
                    onChange={e => patch(i, { options: e.target.value.split('\n') })}
                    rows={3}
                    placeholder={'Instagram\nLinkedIn\nYouTube'}
                    className="w-full resize-y rounded-lg border border-[rgba(23,21,26,.12)] px-3 py-2 text-[13px] leading-[1.5] text-text placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-[12px] text-faint">
                    One option per line. They can always answer with something not on the list.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
        <button type="button" onClick={() => setDrafts([...drafts, blankQuestion(generateId())])}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgba(23,21,26,.2)] py-2.5 text-[13px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-text">
          <Plus size={15} strokeWidth={2.3} />
          Add question
        </button>
        {offered.length > 0 && (
          <button type="button" onClick={addBrandQuestions}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgba(23,21,26,.2)] py-2.5 text-[13px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-text">
            <Plus size={15} strokeWidth={2.3} />
            Add the {offered.length} brand questions
          </button>
        )}
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {problems.map(p => (
            <li key={p} className="text-[12.5px] font-semibold text-accent-text">{p}</li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onSend} disabled={!canSend(drafts)}
        className="mt-3 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
        Send to {name}
      </button>
    </>
  );
}

/** The client's view, read only, drawn from what they will actually get. */
function Preview({ questions, sent }: { questions: FormQuestion[]; sent: boolean }) {
  if (questions.length === 0) {
    return <p className="text-[13px] text-faint">Add a question and it will appear here.</p>;
  }

  return (
    <>
      <p className="mb-3 text-[12.5px] text-faint">
        {sent ? 'This is the questionnaire they have.' : 'This is how it will look to them. Nothing is sent yet.'}
      </p>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.parameterId}>
            <p className="text-[14px] font-semibold text-text">{i + 1}. {q.text}</p>
            <div className="mt-1.5">
              {q.shape === 'yes-no' && (
                <div className="flex gap-1.5">
                  {['Yes', 'No'].map(o => (
                    <span key={o} className="rounded-[10px] bg-control px-3.5 py-1.5 text-[12.5px] font-semibold text-muted">{o}</span>
                  ))}
                </div>
              )}
              {(q.shape === 'single-select' || q.shape === 'multi-select') && (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map(o => (
                    <span key={o} className="rounded-[10px] bg-control px-3 py-1.5 text-[12.5px] text-muted">{o}</span>
                  ))}
                  <span className="rounded-[10px] bg-control px-3 py-1.5 text-[12.5px] italic text-faint">Something else</span>
                </div>
              )}
              {q.shape === 'number' && (
                <span className="tnum inline-block w-24 rounded-lg border border-[rgba(23,21,26,.12)] px-3 py-2 text-[13px] text-faint">0</span>
              )}
              {q.shape === 'text' && (
                <span className="block rounded-lg border border-[rgba(23,21,26,.12)] px-3 py-2 text-[13px] text-faint">One line</span>
              )}
              {q.shape === 'long-text' && (
                <span className="block rounded-lg border border-[rgba(23,21,26,.12)] px-3 py-4 text-[13px] text-faint">In their own words</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}


/** An unanswered question, with a box for the answer she already has. */
function AnswerBox({ skipped, onSave }: { skipped: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-1.5">
      <p className="text-[12.5px] text-faint">{skipped ? 'Skipped by the client.' : 'No response yet.'}</p>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onSave(value); setValue(''); } }}
          placeholder="Record the answer yourself"
          className="min-w-0 flex-1 rounded-lg border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={() => { onSave(value); setValue(''); }} disabled={!value.trim()}
          className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
          Save
        </button>
      </div>
    </div>
  );
}
