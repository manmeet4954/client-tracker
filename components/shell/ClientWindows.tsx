'use client';

// The client's windows — spec 28 §7.3.
//
// A client gets the same frame and the same routes; the resolver removes
// everything their doors do not grant. What is left is the four give-points and
// the see-points, and nothing else (PLAN §4).
//
// Every window here renders ONLY what the server already sent. The shell does
// not enforce the workshop rule — the declarations do, server side — and its
// obligation is the simpler, absolute one: it never routes around them. No
// client screen composes from data the filter removed, and no client screen
// reads an owner path.

import { useState } from 'react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import { putEntry } from '@/lib/tree/body';
import type { BodyEntry, ReviewVerdict } from '@/lib/tree/objects';
import { fileAnswer } from '@/lib/intake/rounds';
import { applySkip, openFormFor, writeSkipped } from '@/lib/intake/form';
import ClientForm from '@/components/intake/ClientForm';
import { accentFor } from '@/lib/shell/profile';
import { generateId } from '@/lib/utils';

const PIECES = 'work-log/creation';
const REVIEW = 'work-log/creation/review';
const PERCEPTION = 'work-log/analysis/client-perception';
const DIGESTS = 'work-log/analysis/digests';
const STRATEGY = 'context/content-strategy';
const OBLIGATIONS = 'context/content-strategy/obligations';

/** The stages a client may ever see. The server has already made this true. */
const SHOWN_STAGES = ['review', 'approved', 'scheduled', 'posted'];

const DEFAULT_VERDICTS: ReviewVerdict[] = ['approve', 'in-scope-revision'];

const VERDICT_WORDS: Record<ReviewVerdict, string> = {
  'approve': 'Looks good',
  'in-scope-revision': 'Small change please',
  'supply-material': 'I need to send you something',
  'reject': 'Not this one',
  'scope-change': 'This is a bigger change',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-stone-200 bg-white px-4 py-5 text-sm text-stone-500">{children}</p>;
}

// ── Brand — the locked strategy summary and their obligations ────────────────

export function BrandWindow({ profileId }: { profileId: string }) {
  const { data } = useClient(profileId);
  const body = data.body;
  const rows: { path: string; label: string; text: string }[] = [];
  for (const path of Object.keys(body?.paths ?? {})) {
    if (path !== STRATEGY && !path.startsWith(`${STRATEGY}/`)) continue;
    if (path === OBLIGATIONS) continue;
    for (const e of body!.paths[path]) {
      const d = e.data as { value?: unknown; key?: string };
      const text = typeof d?.value === 'string' ? d.value : d?.value == null ? '' : JSON.stringify(d.value);
      if (!text) continue;
      rows.push({ path, label: labelOf(path), text });
    }
  }
  const obligations = (body?.paths?.[OBLIGATIONS] ?? [])
    .map(e => (e.data as { value?: unknown })?.value)
    .filter((v): v is string => typeof v === 'string' && !!v);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Section title="Your strategy">
        {rows.length === 0
          ? <Empty>Your summary will be here once it is agreed.</Empty>
          : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={`${r.path}-${i}`} className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-stone-400">{r.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{r.text}</p>
                </div>
              ))}
            </div>
          )}
      </Section>
      <Section title="What we need from you">
        {obligations.length === 0
          ? <Empty>Nothing outstanding right now.</Empty>
          : (
            <ul className="space-y-1.5">
              {obligations.map((o, i) => (
                <li key={i} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800">{o}</li>
              ))}
            </ul>
          )}
      </Section>
    </div>
  );
}

function labelOf(path: string): string {
  return path.split('/').pop()!.replace(/-/g, ' ');
}

// ── Intake — their open round, and their own answers, read-only ─────────────

export function ClientIntakeWindow({ profileId }: { profileId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(profileId);
  const [note, setNote] = useState('');
  const accent = accentFor(client, data);
  const body = data.body;

  // Spec 33 §4. Everything the form knows comes from lib/intake/form.ts; this
  // window only reads the open round and files what the form hands back.
  const open = body ? openFormFor(body) : null;
  if (!body || !open) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Empty>Nothing to answer right now. Thank you.</Empty>
      </div>
    );
  }

  /** Filed the moment it is given. There is no submit at the end (§4). */
  function answer(parameterId: string, value: string) {
    if (!body || !open) return;
    const now = new Date().toISOString();
    const next = fileAnswer(body, {
      round: open.round.version, parameter_id: parameterId, value,
      by: role, source: `round-${open.round.version}`, now, writer: 'client',
    });
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
  }

  /**
   * The skip lives on the round, and `context/intake` is fed by the owner
   * alone — no client action writes the round object (spec 22 §5.2). So this
   * works from her own session today. A CLIENT's skip cannot travel that way,
   * because `context/intake` is fed by the owner alone and no button is worth
   * opening a door S19 does not allow. So it goes through `/api/intake/skip`,
   * which checks the binding and writes as the owner authority.
   */
  async function skip(parameterId: string, on: boolean) {
    if (!body || !open) return;
    const now = new Date().toISOString();

    // The screen moves at once, because saying "later" should feel instant.
    const optimistic = applySkip(open.skipped, parameterId, on);
    try {
      dispatch({
        type: 'SET_BODY',
        payload: { clientId: profileId, body: writeSkipped(body, open.round.id, optimistic, now) },
      });
      setNote('');
    } catch {
      // Her own session writes the round directly. A client's cannot, which is
      // the whole reason the route below exists, so this is expected there and
      // not an error worth showing.
    }

    // And the route records it for real. It checks the caller is bound to this
    // profile and that the round is theirs and open, then writes as the owner
    // authority. A client never writes `context/intake` themselves.
    const res = await fetch('/api/intake/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, roundId: open.round.id, parameterId, on }),
    }).catch(() => null);

    if (!res?.ok) {
      setNote('That one could not be set aside just now. Everything you have answered is still saved.');
    }
  }

  return (
    <>
      {note && (
        <p className="mx-auto max-w-2xl px-4 pt-4 text-[12.5px] leading-[1.5] text-accent-text md:px-8">{note}</p>
      )}
      <ClientForm
        parameters={open.round.parameters}
        questions={open.questions}
        answers={open.answers}
        skipped={open.skipped}
        roundVersion={open.round.version}
        accent={accent}
        onAnswer={answer}
        onSkip={skip}
      />
    </>
  );
}

// ── Content — upcoming, the calendar, the review queue, the perception question ─

export function ContentWindow({ profileId, pieceId }: { profileId: string; pieceId?: string }) {
  const { state, role, dispatch } = useApp();
  const { client, data } = useClient(profileId);
  const [note, setNote] = useState<Record<string, string>>({});
  const accent = accentFor(client, data);
  const body = data.body;

  const pieces = (body?.paths?.[PIECES] ?? []).filter(e => {
    const stage = String((e.data as { stage?: unknown })?.stage ?? '');
    return SHOWN_STAGES.includes(stage);
  });
  // The deep link lands here at a piece (§10). It only ever ORDERS the queue:
  // the link is a delivery route into the review door, never an extra grant.
  const waiting = pieces
    .filter(p => String((p.data as { stage?: string }).stage) === 'review')
    .sort((a, b) => Number(b.id === pieceId) - Number(a.id === pieceId));
  const upcoming = pieces.filter(p => ['approved', 'scheduled'].includes(String((p.data as { stage?: string }).stage)));

  const cfg = (body?.paths?.['context/content-strategy/working-mode'] ?? [])
    .map(e => (e.data as { value?: { allowed_verdicts?: ReviewVerdict[] } })?.value)
    .find(v => Array.isArray(v?.allowed_verdicts));
  const verdicts = cfg?.allowed_verdicts?.length ? cfg.allowed_verdicts : DEFAULT_VERDICTS;

  function record(pieceId: string, verdict: ReviewVerdict) {
    if (!body) return;
    const now = new Date().toISOString();
    let next: ProfileBody = putEntry(body, REVIEW, {
      id: generateId(), type: 'review_record',
      data: { piece_id: pieceId, verdict, note: note[pieceId] ?? '', by: role, at: now },
    }, { writer: 'client', now });
    // Give-point 4, captured at the verdict (PLAN §4). Optional, never a chore.
    const feeling = note[`${pieceId}:feel`];
    if (feeling) {
      next = putEntry(next, PERCEPTION, {
        id: generateId(), type: 'perception',
        data: { piece_id: pieceId, moment: 'client-review', words: feeling, by: role, at: now },
      }, { writer: 'client', now });
    }
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    setNote(n => ({ ...n, [pieceId]: '', [`${pieceId}:feel`]: '' }));
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Section title="Waiting for you">
        {waiting.length === 0
          ? <Empty>Nothing is waiting for your review.</Empty>
          : (
            <div className="space-y-3">
              {waiting.map(p => (
                <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-sm font-medium text-stone-900">{titleOf(p)}</p>
                  <input
                    value={note[p.id] ?? ''}
                    onChange={e => setNote(n => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Anything you want changed"
                    className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={note[`${p.id}:feel`] ?? ''}
                    onChange={e => setNote(n => ({ ...n, [`${p.id}:feel`]: e.target.value }))}
                    placeholder="How do you think this one will do? (optional)"
                    className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {verdicts.map(v => (
                      <button key={v} type="button" onClick={() => record(p.id, v)}
                        className="rounded-full border px-3 py-1.5 text-xs"
                        style={{ borderColor: accent, color: accent }}>
                        {VERDICT_WORDS[v]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </Section>

      <Section title="Coming up">
        {upcoming.length === 0
          ? <Empty>Nothing scheduled yet.</Empty>
          : (
            <ul className="space-y-1.5">
              {upcoming
                .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
                .map(p => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <span className="text-sm text-stone-800">{titleOf(p)}</span>
                    <span className="text-xs text-stone-500">{dateOf(p) || 'no date yet'}</span>
                  </li>
                ))}
            </ul>
          )}
      </Section>
    </div>
  );
}

function titleOf(e: BodyEntry): string {
  return String((e.data as { title?: unknown })?.title ?? 'Untitled');
}

function dateOf(e: BodyEntry): string {
  return String((e.data as { scheduled_date?: unknown })?.scheduled_date ?? '');
}

// ── Results — the latest approved publication, never a live query ────────────

export function ResultsWindow({ profileId }: { profileId: string }) {
  const { data } = useClient(profileId);
  const published = (data.body?.paths?.[DIGESTS] ?? [])
    .filter(e => (e.data as { published?: boolean })?.published === true)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const latest = published[0];

  if (!latest) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Empty>Your first monthly summary will appear here once it is ready.</Empty>
      </div>
    );
  }
  const d = latest.data as { sections?: { heading: string; lines: string[] }[]; period_end?: string };
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <p className="mb-3 text-xs text-stone-500">Up to {d.period_end ?? ''}</p>
      {(d.sections ?? []).map(s => (
        <Section key={s.heading} title={s.heading}>
          <ul className="space-y-1.5">
            {(s.lines ?? []).map((l, i) => (
              <li key={i} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800">{l}</li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}
