'use client';

// The client's questionnaire — spec 33 §4, and the standing rule in §5.
//
// A stranger has to get through this alone, on a phone, and that is the whole
// brief. So the screen answers four questions at all times:
//
//   where am I          "4 of 18", counted from the array, never a percentage
//   how do I go on      Next, on the screen
//   how do I go back    Back, on the screen, never the browser button
//   how do I leave      every answer is filed the moment it is given, and the
//                       screen says so in one plain line
//
// Two things this component is not allowed to do:
//
//   1. Count. Every number and every sentence comes from lib/intake/form.ts.
//   2. Offer to edit a raw answer. There is no edit control here and there
//      never will be (S11). An answer, once sent, is shown as it arrived.
//
// Document storage belongs to another part of spec 33. "Attach something here"
// calls `onAttach(parameterId)` and does nothing else — no upload lives here.

import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Check, Clock, List, Paperclip, X,
} from 'lucide-react';
import type { GeneratedQuestion } from '@/lib/intake/generate';
import type { AnswerRecord } from '@/lib/intake/status';
import type { IntakeDocument } from '@/lib/tree/objects';
import {
  formModel, goBack, goNext, jumpTo, resumeIndex, buildSteps,
  type FormModel, type FormStep, type StepState,
} from '@/lib/intake/form';

export interface ClientFormProps {
  /** The round's parameter ids, in the order it asks them. */
  parameters: string[];
  questions: GeneratedQuestion[];
  answers: AnswerRecord[];
  /** `round.skipped` — the ids they said they would come back to. */
  skipped: string[];
  roundVersion: number;
  documents?: Pick<IntakeDocument, 'answers_parameter'>[];
  /** Identity only. Falls back to the accent token. */
  accent?: string;
  /** Files the answer immediately. There is no submit at the end. */
  onAnswer: (parameterId: string, value: string) => void;
  /** Writes `round.skipped`. See the handoff note for the route this needs. */
  onSkip: (parameterId: string, on: boolean) => void;
  /** Another agent owns document storage. This only asks for it. */
  onAttach?: (parameterId: string) => void;
  /** Pressed on the review screen when everything is done. */
  onDone?: () => void;
}

const DOT: Record<StepState, string> = {
  answered: '#1a7f4b',
  skipped: '#ea4711',
  blank: 'rgba(23,21,26,.14)',
};

export default function ClientForm(props: ClientFormProps) {
  const input = {
    parameters: props.parameters,
    questions: props.questions,
    answers: props.answers,
    skipped: props.skipped,
    documents: props.documents,
    roundVersion: props.roundVersion,
  };

  // Where they left off. Computed once, from the answers that were already
  // filed — which is what makes closing the tab safe.
  const [cursor, setCursor] = useState(() => resumeIndex(buildSteps(input)));
  const [moved, setMoved] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const model = formModel(input, cursor);
  const accent = props.accent || '#ea4711';

  function commit(step: FormStep | null) {
    if (!step || step.state === 'answered') return;
    const value = (draft[step.parameterId] ?? '').trim();
    if (!value) return;
    props.onAnswer(step.parameterId, value);
    if (step.state === 'skipped') props.onSkip(step.parameterId, false);
    setDraft(d => ({ ...d, [step.parameterId]: '' }));
  }

  function move(to: number) {
    commit(model.current);
    setCursor(to);
    setMoved(true);
    setListOpen(false);
  }

  function skip(step: FormStep) {
    props.onSkip(step.parameterId, true);
    setCursor(goNext(model));
    setMoved(true);
  }

  if (model.total === 0) {
    return <Note>No questions to answer right now.</Note>;
  }

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <div className="rounded-card border border-hairline bg-white p-5 md:p-7">
          <p className="font-display text-[21px] font-bold leading-[1.25] tracking-[-.02em] text-text">
            Thank you. Your responses have been submitted.
          </p>
          <p className="mt-2 text-sm leading-[1.6] text-muted">{model.progressLine}</p>
          <button
            type="button"
            onClick={() => { setSent(false); setCursor(model.total); }}
            className="mt-4 rounded-xl border border-[rgba(23,21,26,.14)] px-4 py-2 text-[13px] font-semibold text-text"
          >
            View your answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4 md:p-8">
      <Header model={model} onList={() => setListOpen(true)} />

      {!moved && (
        <p className="rounded-xl bg-control px-4 py-3 text-[13px] leading-[1.55] text-muted">
          {model.resumeLine}
        </p>
      )}

      {model.onReview
        ? (
          <Review
            model={model}
            accent={accent}
            onJump={move}
            onSend={() => { setSent(true); props.onDone?.(); }}
          />
        )
        : (
          <Question
            step={model.current!}
            draft={draft[model.current!.parameterId] ?? ''}
            accent={accent}
            onDraft={v => setDraft(d => ({ ...d, [model.current!.parameterId]: v }))}
            onAttach={props.onAttach ? () => props.onAttach!(model.current!.parameterId) : undefined}
          />
        )}

      {!model.onReview && (
        <Footer
          model={model}
          draft={draft[model.current!.parameterId] ?? ''}
          accent={accent}
          onBack={() => move(goBack(model))}
          onNext={() => move(goNext(model))}
          onSkip={() => skip(model.current!)}
        />
      )}

      <p className="px-1 pb-2 text-center text-[12px] leading-[1.5] text-faint">{model.leaveLine}</p>

      {listOpen && (
        <ListSheet
          model={model}
          onClose={() => setListOpen(false)}
          onJump={i => move(jumpTo(model, i))}
        />
      )}
    </div>
  );
}

// ── Where am I ───────────────────────────────────────────────────────────────

function Header({ model, onList }: { model: FormModel; onList: () => void }) {
  return (
    <div className="rounded-card border border-hairline bg-white px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] font-bold uppercase tracking-[.14em] tabular-nums text-faint">
          {model.positionLine}
        </span>
        {/* On a phone the count gets its own line rather than an ellipsis. */}
        <span className="hidden min-w-0 flex-1 text-[12.5px] text-muted sm:block">{model.progressLine}</span>
        <button
          type="button"
          onClick={onList}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(23,21,26,.14)] px-3 py-1.5 text-[12.5px] font-semibold text-text sm:ml-0"
        >
          <List size={14} strokeWidth={2.1} />
          All questions
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-muted sm:hidden">{model.progressLine}</p>

      {/* One tick per question, counted from the array it describes. */}
      <div className="mt-3 flex gap-[3px]">
        {model.steps.map(s => (
          <span
            key={s.id}
            className="h-[4px] min-w-[3px] flex-1 rounded-full"
            style={{
              background: !model.onReview && s.index === model.cursor ? '#1c1a21' : DOT[s.state],
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── One question ─────────────────────────────────────────────────────────────

function Question({ step, draft, accent, onDraft, onAttach }: {
  step: FormStep;
  draft: string;
  accent: string;
  onDraft: (value: string) => void;
  onAttach?: () => void;
}) {
  return (
    <section className="rounded-card border border-hairline bg-white p-5 md:p-7">
      {step.state === 'skipped' && (
        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-accent-text">
          <Clock size={13} strokeWidth={2.2} />
          Marked for later.
        </p>
      )}

      <p className="font-display text-[19px] font-bold leading-[1.3] tracking-[-.02em] text-text md:text-[23px]">
        {step.text}
      </p>

      {step.state === 'answered'
        ? <Kept step={step} />
        : (
          <Field
            step={step}
            draft={draft}
            accent={accent}
            onDraft={onDraft}
          />
        )}

      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          className="mt-4 flex items-center gap-2 rounded-xl border border-[rgba(23,21,26,.14)] px-3.5 py-2 text-[13px] font-semibold text-text"
        >
          <Paperclip size={14} strokeWidth={2.1} />
          {step.attachments > 0
            ? `Attach another file (${step.attachments} attached)`
            : 'Attach a file'}
        </button>
      )}
    </section>
  );
}

/** Sent, and permanent. There is no edit control here, ever (S11). */
function Kept({ step }: { step: FormStep }) {
  return (
    <div className="mt-4">
      <div className="rounded-[14px] bg-control px-4 py-3.5">
        <p className="m-0 whitespace-pre-wrap text-sm leading-[1.6] text-muted">
          {step.notSaid ? 'You chose not to answer this question.' : step.answer}
        </p>
      </div>
      <p className="mt-2 text-[12px] text-faint">
        Submitted. Answers cannot be edited after they are sent.
      </p>
    </div>
  );
}

function Field({ step, draft, accent, onDraft }: {
  step: FormStep;
  draft: string;
  accent: string;
  onDraft: (value: string) => void;
}) {
  const box = 'mt-4 w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-paper px-3.5 py-3 text-[15px] leading-[1.55] text-text placeholder:text-faint focus:border-accent focus:outline-none';

  if (step.shape === 'yes-no') {
    return (
      <div className="mt-4 flex gap-2">
        {['Yes', 'No'].map(word => (
          <Chip key={word} on={draft === word} accent={accent} onClick={() => onDraft(word)}>
            {word}
          </Chip>
        ))}
      </div>
    );
  }

  if (step.options.length > 0 && (step.shape === 'single-select' || step.shape === 'multi-select' || step.shape === 'list')) {
    const many = step.shape !== 'single-select';
    const chosen = draft ? draft.split(', ').filter(Boolean) : [];
    const toggle = (option: string) => {
      if (!many) { onDraft(option); return; }
      const next = chosen.includes(option) ? chosen.filter(c => c !== option) : [...chosen, option];
      onDraft(next.join(', '));
    };
    return (
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {step.options.map(option => (
            <Chip key={option} on={chosen.includes(option)} accent={accent} onClick={() => toggle(option)}>
              {option}
            </Chip>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={e => onDraft(e.target.value)}
          rows={2}
          placeholder={step.freeTextLane ?? 'Or type your own answer'}
          className={box}
        />
      </div>
    );
  }

  if (step.shape === 'number') {
    return (
      <input
        value={draft}
        onChange={e => onDraft(e.target.value)}
        inputMode="numeric"
        placeholder="Enter a number"
        className={box}
      />
    );
  }

  if (step.shape === 'text') {
    return (
      <input
        value={draft}
        onChange={e => onDraft(e.target.value)}
        placeholder="Your answer"
        className={box}
      />
    );
  }

  return (
    <textarea
      value={draft}
      onChange={e => onDraft(e.target.value)}
      rows={5}
      placeholder="Type your answer"
      className={box}
    />
  );
}

function Chip({ on, accent, onClick, children }: {
  on: boolean; accent: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3.5 py-2 text-[13.5px] font-semibold',
        on ? 'text-white' : 'border-transparent bg-control text-muted',
      ].join(' ')}
      style={on ? { background: accent, borderColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

// ── How do I go on, how do I go back ─────────────────────────────────────────

function Footer({ model, draft, accent, onBack, onNext, onSkip }: {
  model: FormModel;
  draft: string;
  accent: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = model.current!;
  const has = draft.trim().length > 0;
  const last = step.index === model.total - 1;
  const nextWords = has ? 'Save and continue' : last ? 'Review' : 'Next';

  return (
    <div className="sticky bottom-0 -mx-4 mt-1 border-t border-hairline bg-paper px-4 pb-4 pt-3 md:mx-0 md:rounded-card md:border md:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={model.backIndex === null}
          className="flex items-center gap-1 rounded-xl border border-[rgba(23,21,26,.14)] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-text disabled:opacity-35"
        >
          <ChevronLeft size={15} strokeWidth={2.2} />
          Back
        </button>

        <button
          type="button"
          onClick={onNext}
          className="ml-auto flex items-center gap-1 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white"
          style={{ background: has ? accent : '#1c1a21' }}
        >
          {nextWords}
          <ChevronRight size={15} strokeWidth={2.2} />
        </button>
      </div>

      {step.state !== 'answered' && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 w-full rounded-xl py-2 text-[13px] font-semibold text-muted"
        >
          Answer later
        </button>
      )}
    </div>
  );
}

// ── The list view: all of it, at a glance ────────────────────────────────────

function ListSheet({ model, onClose, onJump }: {
  model: FormModel;
  onClose: () => void;
  onJump: (index: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(23,21,26,.28)] sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-frame bg-white sm:max-w-md sm:rounded-frame"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-divider px-4 py-3.5">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-text">All questions</span>
          <span className="text-[12.5px] tabular-nums text-faint">{model.progressLine}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted">
            <X size={18} strokeWidth={2.1} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {model.steps.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.index)}
              className="flex w-full items-start gap-3 border-b border-divider px-4 py-3 text-left"
            >
              <span className="mt-[3px] text-[12px] font-bold tabular-nums text-faint">{s.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-[1.45] text-text">{s.text}</span>
                <span className="mt-0.5 block text-[12px] text-faint">{s.stateLine}</span>
              </span>
              <span className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: DOT[s.state] }} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onJump(model.total)}
          className="border-t border-divider px-4 py-3.5 text-left text-[13.5px] font-semibold text-text"
        >
          Go to review
        </button>
      </div>
    </div>
  );
}

// ── The last step is a review, not a submit button ───────────────────────────

function Review({ model, accent, onJump, onSend }: {
  model: FormModel;
  accent: string;
  onJump: (index: number) => void;
  onSend: () => void;
}) {
  const first = model.resumeIndex < model.total ? model.resumeIndex : null;

  return (
    <section className="rounded-card border border-hairline bg-white p-5 md:p-7">
      <p className="font-display text-[21px] font-bold leading-[1.25] tracking-[-.02em] text-text md:text-[26px]">
        Review your answers
      </p>
      <p className="mt-2 text-sm leading-[1.6] text-muted">{model.sendLine}</p>

      <Group title="Answered" steps={model.review.answered} onJump={onJump} />
      <Group title="Marked for later" steps={model.review.skipped} onJump={onJump} />
      <Group title="Not answered" steps={model.review.blank} onJump={onJump} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={!model.canSend}
          className="rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-35"
          style={{ background: accent }}
        >
          Submit
        </button>
        {first !== null && (
          <button
            type="button"
            onClick={() => onJump(first)}
            className="rounded-xl border border-[rgba(23,21,26,.14)] px-4 py-2.5 text-[13.5px] font-semibold text-text"
          >
            Go to the first remaining question
          </button>
        )}
      </div>
    </section>
  );
}

function Group({ title, steps, onJump }: {
  title: string; steps: FormStep[]; onJump: (index: number) => void;
}) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="text-[11.5px] font-bold uppercase tracking-[.14em] tabular-nums text-faint">
        {title}, {steps.length}
      </p>
      <div className="mt-1.5">
        {steps.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(s.index)}
            className="flex w-full items-start gap-2.5 border-b border-divider py-2.5 text-left last:border-b-0"
          >
            <span className="mt-[3px] shrink-0 text-muted">
              {s.state === 'answered'
                ? <Check size={14} strokeWidth={2.4} color="#1a7f4b" />
                : <Clock size={14} strokeWidth={2.2} color={s.state === 'skipped' ? '#ea4711' : '#9b95a1'} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-[1.45] text-text">{s.text}</span>
              {s.state === 'answered' && (
                <span className="mt-0.5 block whitespace-pre-wrap text-[12.5px] leading-[1.5] text-faint">
                  {s.notSaid ? 'You chose not to answer this question.' : s.answer}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
      <p className="rounded-card border border-hairline bg-white px-4 py-5 text-sm text-muted">{children}</p>
    </div>
  );
}
