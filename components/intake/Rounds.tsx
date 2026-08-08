'use client';

// Intake → Rounds. Restructure handoff, "Level 3 → INTAKE", and the prototype
// at docs/design-handoff/design/RoomsV3.dc.html.
//
// The card, exactly as the design draws it:
//   9px status dot   #1a7f4b answered, #ea4711 open
//   name             16px/600
//   state pill       11.5px/600, radius 999, green on #e6f5ec or accent on
//                    rgba(234,71,17,.10)
//   questions        listed beneath, 14px, each with its own state on the right
//   actions          "Send a new round", "Copy the client link"
//
// Everything a card says comes from lib/intake/screens.ts. Nothing here counts.
//
// One thing the design does not draw, kept on purpose: a question row opens.
// Closed it is exactly the row the design specifies. Opened, an answered
// question shows the words as they arrived (no edit control anywhere, ever),
// and a waiting one lets her file what they said in a recorded meeting, which
// is the only way a finding-session round ever gets its answers.

import { useState } from 'react';
import { Check, FileText, Link2, Mic, Plus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { IntakeDelivery } from '@/lib/tree/objects';
import Documents from './Documents';
import { fileAnswer, openRound, refreshRounds, sendRound } from '@/lib/intake/rounds';
import { curatedIds } from '@/lib/intake/curate';
import {
  composeRounds, sendBlockedLine, shortDate, plural,
  type AnswerLine, type QuestionLine, type RoundCard,
} from '@/lib/intake/screens';
import { switchConfigFromBody } from '@/lib/strategy/derivation';

export default function Rounds({ clientId, body }: { clientId: string; body: ProfileBody }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const cards = composeRounds(body);

  function save(next: ProfileBody, message = '') {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    setNote(message);
  }

  /**
   * The design's one button. It writes the round and puts it out in the same
   * move, because that is what "Send a new round" says it does. When the send
   * refuses (§4 rule 1: no round goes out carrying the draft wording), the
   * round is still written and the reason is said plainly.
   */
  function open(delivery: IntakeDelivery) {
    const now = new Date().toISOString();
    const result = openRound(body, {
      delivery, config: switchConfigFromBody(body), now,
      curated: curatedIds(body), platforms: data.platforms ?? ['Instagram'],
    });
    const n = result.round.parameters.length;
    const out = sendRound(result.body, result.round.id, now);

    if ('blocked' in out) {
      const b = out.blocked.length;
      save(
        result.body,
        `Round ${result.round.version} is written, with ${n} ${plural(n, 'question', 'questions')} in it. ` +
        `It has not gone out: ${b} ${plural(b, 'question is', 'questions are')} still in the draft wording, ` +
        'so read them and make them yours first.',
      );
      return;
    }
    save(
      refreshRounds(out.body, now),
      `Round ${result.round.version} is out, with ${n} ${plural(n, 'question', 'questions')} in it.`,
    );
  }

  function send(card: RoundCard) {
    const now = new Date().toISOString();
    const result = sendRound(body, card.id, now);
    if ('blocked' in result) {
      setNote(sendBlockedLine(card));
      return;
    }
    save(refreshRounds(result.body, now), `Round ${card.version} is out.`);
  }

  function record(version: number, parameterId: string, value: string, kind: 'answer' | 'skipped') {
    const now = new Date().toISOString();
    const next = fileAnswer(body, {
      round: version, parameter_id: parameterId, kind, value,
      by: 'owner', source: `finding-session:round-${version}`, now,
    });
    save(refreshRounds(next, now));
  }

  function copyLink() {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const link = `${origin}/profile/${clientId}/intake`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => undefined);
    }
    setCopied(true);
    setNote(`Their link is copied. ${link}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {note && (
        <p className="rounded-2xl border border-hairline bg-white px-[18px] py-3 text-sm leading-[1.5] text-muted">
          {note}
        </p>
      )}

      {cards.map(card => (
        <Card
          key={card.id}
          card={card}
          onSend={() => send(card)}
          onRecord={(pid, value, kind) => record(card.version, pid, value, kind)}
          documents={(
            <Documents
              clientId={clientId}
              body={body}
              round={card.version}
              questions={card.questions.map(q => ({ parameterId: q.parameterId, text: q.text }))}
            />
          )}
        />
      ))}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => open('dashboard-questionnaire')}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white"
        >
          <Plus size={15} strokeWidth={2.2} />
          Send a new round
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] px-[17px] py-[9px] text-[13.5px] font-semibold text-text"
        >
          {copied ? <Check size={15} strokeWidth={2.2} /> : <Link2 size={15} strokeWidth={2.2} />}
          Copy the client link
        </button>
        <button
          type="button"
          onClick={() => open('finding-session')}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] px-[17px] py-[9px] text-[13.5px] font-semibold text-text"
        >
          <Mic size={15} strokeWidth={2.2} />
          Open one for a recorded meeting
        </button>
        {/* Spec 33 §2, the third route: they hand things over instead of typing. */}
        <button
          type="button"
          onClick={() => open('documents')}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] px-[17px] py-[9px] text-[13.5px] font-semibold text-text"
        >
          <FileText size={15} strokeWidth={2.2} />
          Open one for documents
        </button>
      </div>
    </div>
  );
}

function Card({ card, onSend, onRecord, documents }: {
  card: RoundCard;
  onSend: () => void;
  onRecord: (parameterId: string, value: string, kind: 'answer' | 'skipped') => void;
  /** Spec 33 §2. What they handed over on this round, listed on the card. */
  documents?: React.ReactNode;
}) {
  const blocked = sendBlockedLine(card);

  return (
    <section className="rounded-card border border-hairline bg-white shadow-card">
      <header className="flex items-center gap-3 px-[18px] py-4">
        <span
          className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: card.done ? '#1a7f4b' : '#ea4711' }}
        />
        <span className="min-w-0 flex-1 text-base font-semibold text-text">{card.name}</span>
        <span
          className={[
            'whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold tabular-nums',
            card.done
              ? 'bg-positive-bg text-positive'
              : 'bg-[rgba(234,71,17,.10)] text-accent-text',
          ].join(' ')}
        >
          {card.pill}
        </span>
      </header>

      {card.questions.map(q => (
        <QuestionRow
          key={q.id}
          question={q}
          onRecord={(value, kind) => onRecord(q.parameterId, value, kind)}
        />
      ))}

      {card.questions.length === 0 && (
        <p className="border-t border-divider px-[18px] py-3 text-sm text-faint">
          This round asks nothing. Everything in it is either curated already or switched off here.
        </p>
      )}

      {documents}

      {card.status === 'not-sent' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-divider px-[18px] py-3.5">
          {card.sendable && (
            <button
              type="button"
              onClick={onSend}
              className="whitespace-nowrap rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-white"
            >
              Send it
            </button>
          )}
          {blocked && <span className="min-w-[14rem] flex-1 text-[12.5px] leading-[1.5] text-muted">{blocked}</span>}
        </div>
      )}
    </section>
  );
}

function QuestionRow({ question, onRecord }: {
  question: QuestionLine;
  onRecord: (value: string, kind: 'answer' | 'skipped') => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <div className="border-t border-divider">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-start gap-3 px-[18px] py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm leading-[1.45] text-text">{question.text}</span>
        <span className="mt-[2px] whitespace-nowrap text-[12.5px] text-faint">{question.label}</span>
      </button>

      {open && (
        <div className="px-[18px] pb-3.5">
          {question.answers.map(a => <Kept key={a.id} answer={a} />)}

          {question.state === 'waiting' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Write what they said, in their words"
                className="min-w-[12rem] flex-1 rounded-xl border border-[rgba(23,21,26,.12)] px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { if (draft.trim()) { onRecord(draft.trim(), 'answer'); setDraft(''); } }}
                className="whitespace-nowrap rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-white"
              >
                File it
              </button>
              <button
                type="button"
                onClick={() => onRecord('', 'skipped')}
                className="whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold text-muted"
              >
                They would not say
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One answer, kept. There is no edit control here and there never will be: a
 * raw answer is permanent, and curating is the only path from it to something
 * the system uses (S11).
 */
function Kept({ answer }: { answer: AnswerLine }) {
  return (
    <div className="mt-2 rounded-[14px] bg-control px-3.5 py-3">
      <p className="m-0 text-sm leading-[1.6] text-muted">
        {answer.kind === 'skipped' ? 'They chose not to answer this.' : answer.value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-faint">
        {answer.by}, round {answer.round}
        {answer.at ? `, ${shortDate(answer.at)}` : ''}
      </p>
    </div>
  );
}
