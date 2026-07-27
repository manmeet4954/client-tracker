'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Send, RotateCcw, Mic, Lock } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { IntakeRound } from '@/lib/tree/objects';
import { findParameter } from '@/lib/intake/parameters';
import {
  openRound, sendRound, fileAnswer, readRounds, readAnswers, readQuestions, refreshRounds,
} from '@/lib/intake/rounds';
import { curatedIds } from '@/lib/intake/curate';
import { unanswered, intakeRetired } from '@/lib/intake/status';
import { switchConfigFromBody } from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';

/**
 * The Intake app, her side (spec 22 §5).
 *
 * Intake is only the way information travels from a client to us. It owns no
 * question of its own: every question here is generated from a parameter in
 * personal-details or business-details, and the answers come back raw and stay
 * raw forever.
 */
export default function IntakeView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const [note, setNote] = useState('');

  const body = data.body;
  const save = (next: ProfileBody, message?: string) => {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    if (message !== undefined) setNote(message);
  };

  const rounds = useMemo(() => (body ? readRounds(body) : []), [body]);
  const answers = useMemo(() => (body ? readAnswers(body) : []), [body]);

  if (role !== 'owner') {
    return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  }
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const config = switchConfigFromBody(body);
  const curated = curatedIds(body);
  const current = rounds.filter(r => r.status !== 'curated').pop() ?? rounds[rounds.length - 1];

  function open(delivery: IntakeRound['delivery']) {
    const now = new Date().toISOString();
    const result = openRound(body!, {
      delivery, config, now, curated, platforms: data.platforms ?? ['Instagram'],
    });
    save(result.body, `Round ${result.round.version} is open with ${result.round.parameters.length} questions.`);
  }

  function send(round: IntakeRound) {
    const now = new Date().toISOString();
    const result = sendRound(body!, `round-${round.version}`, now);
    if ('blocked' in result) {
      setNote(
        `This round cannot go out yet. ${result.blocked.length} questions are still in the draft wording ` +
        'waiting on your vocabulary pass. Nothing else is waiting on it.',
      );
      return;
    }
    save(refreshRounds(result.body, now), `Round ${round.version} is out.`);
  }

  function record(round: IntakeRound, parameterId: string, value: string, kind: 'answer' | 'skipped') {
    const now = new Date().toISOString();
    const next = fileAnswer(body!, {
      round: round.version, parameter_id: parameterId, kind, value,
      by: 'owner', source: `finding-session:round-${round.version}`, now,
    });
    save(refreshRounds(next, now), '');
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <ClipboardList size={18} className="text-stone-500" />
          Intake
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          How the client tells us things. The questions come from the parameter list, so adding a
          parameter adds a question here by itself. Answers are kept exactly as given, forever.
        </p>
      </header>

      {note && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          {note}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => open('dashboard-questionnaire')}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 hover:opacity-90">
          <RotateCcw size={15} /> Open a round they fill in
        </button>
        <button onClick={() => open('finding-session')}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
          <Mic size={15} /> Open a round for a recorded meeting
        </button>
      </div>

      {rounds.length === 0 && (
        <p className="text-sm text-stone-400">No rounds yet. Open one to see the questions it would ask.</p>
      )}

      {intakeRetired(rounds) && (
        <div className="mb-4 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
          Intake is done here. Every round is curated, so this stops being a place they visit.
          Reopen a round any time and it comes back.
        </div>
      )}

      <div className="space-y-4">
        {rounds.slice().reverse().map(round => (
          <RoundCard
            key={round.version}
            round={round}
            questions={readQuestions(body, round.version)}
            answers={answers.filter(a => a.round_version === round.version)}
            open={round.version === current?.version}
            onSend={() => send(round)}
            onRecord={(p, v, kind) => record(round, p, v, kind)}
          />
        ))}
      </div>
    </div>
  );
}

function RoundCard({ round, questions, answers, open, onSend, onRecord }: {
  round: IntakeRound;
  questions: ReturnType<typeof readQuestions>;
  answers: ReturnType<typeof readAnswers>;
  open: boolean;
  onSend: () => void;
  onRecord: (parameterId: string, value: string, kind: 'answer' | 'skipped') => void;
}) {
  const [expanded, setExpanded] = useState(open);
  const drafts = questions.filter(q => q.vocabulary_draft).length;
  const waiting = unanswered(
    { version: round.version, parameters: round.parameters, sent: round.status !== 'not-sent', curation: round.curation ?? {} },
    answers,
  );

  return (
    <section className="bg-white border border-stone-200 rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-100">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">
            Round {round.version}
            <span className="ml-2 font-normal text-stone-400">
              {round.delivery === 'finding-session' ? 'recorded meeting' : 'they fill it in'}
            </span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {STATUS_WORDS[round.status]} · {round.parameters.length} questions
            {waiting.length > 0 && ` · ${waiting.length} still open`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {round.status === 'not-sent' && (
            <button onClick={onSend}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-stone-900 hover:opacity-90">
              <Send size={13} /> Send it
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50">
            {expanded ? 'Hide' : 'Show'} questions
          </button>
        </div>
      </header>

      {drafts > 0 && (
        <p className="flex items-start gap-2 px-4 py-2.5 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
          <Lock size={13} className="mt-0.5 shrink-0" />
          {drafts} of these are still in the draft wording. Nothing goes to a client until you have read
          the words and made them yours.
        </p>
      )}

      {expanded && (
        <div className="divide-y divide-stone-100">
          {questions.map(q => {
            const given = answers.filter(a => a.parameter_id === q.parameter_id);
            return (
              <QuestionRow key={q.id} question={q.text} label={findParameter(q.parameter_id)?.label ?? q.parameter_id}
                options={q.options} answers={given.map(a => ({ value: a.value, by: a.by, kind: a.kind }))}
                onRecord={(value, kind) => onRecord(q.parameter_id, value, kind)} />
            );
          })}
          {questions.length === 0 && (
            <p className="px-4 py-3 text-sm text-stone-400">
              This round asks nothing. Everything in it is either already curated or switched off for this profile.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const STATUS_WORDS: Record<IntakeRound['status'], string> = {
  'not-sent': 'not sent yet',
  sent: 'with them',
  answered: 'answered, waiting on your reading',
  curated: 'curated',
};

function QuestionRow({ question, label, options, answers, onRecord }: {
  question: string;
  label: string;
  options: string[];
  answers: { value: string; by: string; kind: string }[];
  onRecord: (value: string, kind: 'answer' | 'skipped') => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="px-4 py-3">
      <p className="text-sm text-stone-900">{question}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}{options.length > 0 && ` · ${options.join(' / ')}`}</p>

      {answers.map((a, i) => (
        <p key={i} className="mt-2 text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2">
          {a.kind === 'skipped' ? <span className="text-stone-400">They chose not to answer this.</span> : a.value}
          <span className="block text-xs text-stone-400 mt-1">said by {a.by}</span>
        </p>
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Write what they said, in their words"
          className="flex-1 min-w-[12rem] text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400"
        />
        <button
          onClick={() => { if (draft.trim()) { onRecord(draft.trim(), 'answer'); setDraft(''); } }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
          File it
        </button>
        <button
          onClick={() => onRecord('', 'skipped')}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-50">
          They would not say
        </button>
      </div>
    </div>
  );
}
