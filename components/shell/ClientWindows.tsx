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
import { X } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import { putEntry } from '@/lib/tree/body';
import type { BodyEntry, ReviewVerdict } from '@/lib/tree/objects';
import { fileAnswer } from '@/lib/intake/rounds';
import { applySkip, openFormFor, writeSkipped } from '@/lib/intake/form';
import ClientForm from '@/components/intake/ClientForm';
import { EditPiece, Panel } from '@/components/creation/PiecePanel';
import Compare from '@/components/mockup/Compare';
import { readMockups } from '@/lib/mockup/profile';
import { accentFor, renderProfile } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import { generateId } from '@/lib/utils';

const PIECES = 'work-log/creation';
const REVIEW = 'work-log/creation/review';
const PERCEPTION = 'work-log/analysis/client-perception';
const DIGESTS = 'work-log/analysis/digests';
const STRATEGY = 'context/content-strategy';
const OBLIGATIONS = 'context/content-strategy/obligations';

const DEFAULT_VERDICTS: ReviewVerdict[] = ['approve', 'in-scope-revision'];

const VERDICT_WORDS: Record<ReviewVerdict, string> = {
  'approve': 'Approve',
  'in-scope-revision': 'Request a revision',
  'supply-material': 'I need to send materials',
  'reject': 'Decline',
  'scope-change': 'Request a larger change',
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
  const { state, role } = useApp();
  const { data } = useClient(profileId);
  const body = data.body;
  const rp = renderProfile(state, profileId, role);
  // The newest one she has not archived. Same reader her own screen uses.
  const mockup = body ? (readMockups(body)[0] ?? null) : null;
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

  // 2026-08-11, and this was found by an angry screenshot of an empty page.
  // The window read only the tree's strategy decisions, and her brands' facts
  // live in the brand slices she actually types into, so a client saw
  // "will appear once finalized" over a strategy that was half built. The
  // same dead lock-rule she ordered removed, surviving one layer deeper: the
  // strategy shows AS IT STANDS. The client login already receives these
  // slices; nothing new crosses the boundary. Her private client-profile
  // notes (brand.strategy) are deliberately NOT among them.
  const have = new Set(rows.map(r => r.label.toLowerCase()));
  const facts: [string, string][] = [
    ['positioning', data.brand?.tagline ?? ''],
    ['audience', data.brand?.audience ?? ''],
    ['voice', data.brand?.voice ?? ''],
    ['pillars', (data.pillars ?? []).map(pl => pl.name).join(' · ')],
    ['platforms', (data.platforms ?? []).join(' · ')],
  ];
  for (const [label, text] of facts) {
    if (text.trim() && !have.has(label)) rows.push({ path: label, label, text });
  }
  const obligations = (body?.paths?.[OBLIGATIONS] ?? [])
    .map(e => (e.data as { value?: unknown })?.value)
    .filter((v): v is string => typeof v === 'string' && !!v);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Section title="Your strategy">
        {rows.length === 0
          ? <Empty>Your strategy summary will appear here once it is finalized.</Empty>
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
      {/* THEIR PROFILE, BEFORE AND AFTER (2026-08-17, her brief: "when someone
          is given the link, they can see the optimized profile, but they can
          also see the before version of their profile... compare them in
          parallel"). It rides `strategy.profile_mockup` — the same plug her own
          Profile mockup panel rides — so it appears exactly when she has that
          switched on for them, and it is HER Compare component with the upload
          absent, never a client copy of one. */}
      {mockup && renderState(rp, 'strategy.profile_mockup', 'client') !== 'hidden' && (
        <Section title="Your profile">
          <Compare mockup={mockup} />
        </Section>
      )}

      <Section title="Requested from you">
        {obligations.length === 0
          ? <Empty>No outstanding requests.</Empty>
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
  //
  // A 2026-08-11 RULING LIVES HERE: a round is servable to a CLIENT only if
  // she authored its questions (a built form or the brand facts). The
  // 53-parameter bank was retired as a route, but rounds sent from it in the
  // old days still sat open in profile bodies, and a client login met
  // "1 OF 53". History keeps them; clients are never asked them again.
  //
  // The "Share an idea" box LIVED HERE and is gone (2026-08-16, her verdict on
  // the client view: the client sees HER dashboard filtered, not a parallel
  // UI with boxes of its own). Intake is the real intake — the questions she
  // sent — and nothing else. `creation.seed_input_client` stays registered;
  // only this surface went.
  const rawOpen = body ? openFormFor(body) : null;
  const open = rawOpen && rawOpen.round.parameters.some(
    pid => pid.startsWith('own.') || pid.startsWith('fact.'),
  ) ? rawOpen : null;
  if (!body || !open) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Empty>Nothing to answer right now.</Empty>
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
      setNote('This question could not be marked for later. Your answers are saved.');
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

// ── The piece panel, client side — the verdict lives ON the piece ────────────
//
// The "Approvals" and "Upcoming" digest tabs LIVED HERE as ContentWindow and
// are gone (2026-08-16, her verdict: the client sees HER dashboard filtered,
// not a parallel UI). The client reads the REAL board; tapping a card opens
// this panel, and a Review-stage piece carries its verdict controls right
// here — the act happens where the thing is. The writes are UNCHANGED: the
// same review_record through give:review, the same optional perception line
// through give:perception, exactly what the Approvals tab filed.

/*
 * `ClientIdeaLane` LIVED HERE for one day (2026-08-16 to 08-17) and is gone.
 * It was a client-special one-field box, and her correction was direct: "you
 * don't have to build anything new... the add post feature is in my
 * dashboard, where you can select the pillar, where you can add the content
 * and everything." The client's Idea column now renders HER AddEntry card
 * (see the creation page), writing the same ContentCard through the same
 * ADD_CONTENT_CARD. Nothing client-special exists on this lane any more.
 */

export function ClientPiecePanel({ profileId, pieceId, onClose, mayEdit = false }: {
  profileId: string; pieceId: string; onClose: () => void;
  /** Her board switch for this client. When it is on, they edit the piece with
   *  HER editor — the same EditPiece, the same UPDATE_CONTENT_CARD (rule 0). */
  mayEdit?: boolean;
}) {
  const { state, role, dispatch, saveNow } = useApp();
  const [editing, setEditing] = useState(false);
  const { client, data } = useClient(profileId);
  const [note, setNote] = useState('');
  const [feel, setFeel] = useState('');
  const [saidTo, setSaidTo] = useState('');
  const accent = accentFor(client, data);
  const body = data.body;

  // The board draws from the cards; the tree's piece carries the same id for
  // everything migrated (lib/tree/migrate.ts writes pieces as card.id). Read
  // whichever is present, prefer the tree.
  const entry = (body?.paths?.[PIECES] ?? []).find(e => e.id === pieceId);
  const card = (data.contentCards ?? []).find(c => c.id === pieceId);
  if (!entry && !card) return null;
  const title = entry ? titleOf(entry) : String(card?.title ?? 'Untitled');
  const stage = entry
    ? String((entry.data as { stage?: unknown })?.stage ?? '')
    : String(card?.stage ?? '');

  const rp = renderProfile(state, profileId, role);
  const mayReview = stage === 'review'
    && renderState(rp, 'creation.review', 'client') === 'active';

  const cfg = (body?.paths?.['context/content-strategy/working-mode'] ?? [])
    .map(e => (e.data as { value?: { allowed_verdicts?: ReviewVerdict[] } })?.value)
    .find(v => Array.isArray(v?.allowed_verdicts));
  const verdicts = cfg?.allowed_verdicts?.length ? cfg.allowed_verdicts : DEFAULT_VERDICTS;

  function record(verdict: ReviewVerdict) {
    if (!body) return;
    const now = new Date().toISOString();
    let next: ProfileBody = putEntry(body, REVIEW, {
      id: generateId(), type: 'review_record',
      data: { piece_id: pieceId, verdict, note, by: role, at: now },
    }, { writer: 'client', now });
    // Give-point 4, captured at the verdict (PLAN §4). Optional, never a chore.
    if (feel) {
      next = putEntry(next, PERCEPTION, {
        id: generateId(), type: 'perception',
        data: { piece_id: pieceId, moment: 'client-review', words: feel, by: role, at: now },
      }, { writer: 'client', now });
    }
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    setNote('');
    setFeel('');
    setSaidTo(VERDICT_WORDS[verdict].toLowerCase());
  }

  // HER editor, not a client copy of one (rule 0). Same component, same fields,
  // same UPDATE_CONTENT_CARD. Only reachable when her board switch is on for
  // this client, and only on a card that exists in their own profile.
  if (editing && card) {
    return (
      <Panel title={card.title || 'Untitled post'} onClose={onClose}>
        <EditPiece
          card={card}
          pillars={data.pillars ?? []}
          allCards={data.contentCards ?? []}
          onCancel={() => setEditing(false)}
          onSave={next => {
            dispatch({ type: 'UPDATE_CONTENT_CARD', payload: { clientId: profileId, card: next } });
            void saveNow();
            setEditing(false);
          }}
        />
      </Panel>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,21,26,.34)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-stone-900">{title}</p>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-stone-400">{stageLine(stage)}</p>
          </div>
          {mayEdit && card && (
            <button type="button" onClick={() => setEditing(true)}
              className="flex-none text-[12.5px] font-semibold text-stone-500 hover:text-stone-900">
              Edit
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="flex text-stone-400 hover:text-stone-700">
            <X size={19} strokeWidth={2.2} />
          </button>
        </div>

        {mayReview && !saidTo && (
          <div className="mt-4">
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              value={feel}
              onChange={e => setFeel(e.target.value)}
              placeholder="How do you expect this to perform? (optional)"
              className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {verdicts.map(v => (
                <button key={v} type="button" onClick={() => record(v)}
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={{ borderColor: accent, color: accent }}>
                  {VERDICT_WORDS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {saidTo && (
          <p className="mt-4 text-sm text-stone-600">Recorded: {saidTo}. Thank you.</p>
        )}
      </div>
    </div>
  );
}

function stageLine(stage: string): string {
  switch (stage) {
    case 'review': return 'Waiting on your review';
    case 'approved': return 'Approved';
    case 'scheduled': return 'Scheduled';
    case 'posted': return 'Posted';
    default: return stage;
  }
}

function titleOf(e: BodyEntry): string {
  return String((e.data as { title?: unknown })?.title ?? 'Untitled');
}

// ── Analysis — the latest approved publication, never a live query ───────────
// Renamed from ResultsWindow on 2026-08-16: her name for the folder is
// Analysis, and the client's window carries her names. Content unchanged.

export function AnalysisWindow({ profileId }: { profileId: string }) {
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
