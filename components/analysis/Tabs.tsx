'use client';

// The eight tabs — spec 27 §5 and §6 to §16. Each one is a WINDOW onto the one
// computation layer: nothing here computes, nothing here queries, and nothing
// here has its own idea of what a number means. Every payload arrives from
// /api/analysis already resolved into the four states.

import { Band, CoverageBanner, Empty, Figure, SectionTitle, ShowMyWorking, TooEarly, formatNumber, percentWords } from './Shared';
import type { Coverage, Measured } from './Shared';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = Record<string, any>;

// ── Now ──────────────────────────────────────────────────────────────────────

export function NowTab({ payload }: { payload: Payload }) {
  const now = payload.now;
  if (!now) return <Empty>Nothing to show yet.</Empty>;
  return (
    <div className="space-y-4">
      {/* The Now tab's FIRST block is always coverage. */}
      <CoverageBanner coverage={payload.coverage as Coverage} />
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="text-sm text-stone-600">{now.first_block}</div>
        <div className="mt-2 text-sm text-stone-900">{now.posted} posted this month so far.</div>
      </div>

      <SectionTitle>Pillars right now</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {(now.pillars ?? []).map((p: Payload) => (
          <div key={p.pillar_id} className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-stone-900">{p.name}</span>
              <Band state={p.state} />
            </div>
            <div className="mt-1 text-xs text-stone-500">{p.quantity.words}</div>
          </div>
        ))}
      </div>

      <SectionTitle>Anything moving</SectionTitle>
      {(now.moving ?? []).length === 0
        ? <Empty>Nothing has moved far enough from your own normal to call.</Empty>
        : (
          <ul className="space-y-2">
            {now.moving.map((m: Payload, i: number) => (
              <li key={i} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <Band state={m.band} />
                <span className="ml-2 text-stone-900">{m.dimension} &ldquo;{m.value}&rdquo;</span>
                <span className="ml-2 text-stone-500">{m.words}</span>
              </li>
            ))}
          </ul>
        )}

      {now.last_verdict ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
          <div className="text-xs uppercase tracking-wide text-stone-500">Last verdict</div>
          <div className="mt-1">{now.last_verdict.headline}</div>
        </div>
      ) : null}
    </div>
  );
}

// ── Slices ───────────────────────────────────────────────────────────────────

export function SlicesTab({
  payload, dimension, cross, onDimension, onCross,
}: {
  payload: Payload;
  dimension: string;
  cross: string;
  onDimension: (d: string) => void;
  onCross: (d: string) => void;
}) {
  const sliced = payload.slice;
  const dimensions = payload.dimensions ?? [];
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={sliced?.coverage as Coverage} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-wide text-stone-500">Split by</label>
        <select
          value={dimension}
          onChange={e => onDimension(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm"
        >
          {dimensions.map((d: Payload) => (
            <option key={d.id} value={d.id}>{d.label}{d.fallback ? ' (read, not planned)' : ''}</option>
          ))}
        </select>
        <label className="text-xs uppercase tracking-wide text-stone-500">crossed with</label>
        <select
          value={cross}
          onChange={e => onCross(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm"
        >
          <option value="">nothing</option>
          {dimensions.filter((d: Payload) => d.id !== dimension).map((d: Payload) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>

      {!sliced || sliced.cells.length === 0
        ? <Empty>Nothing posted in this period carries that parameter yet.</Empty>
        : (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Pieces</th>
                  <th className="px-3 py-2">Typical</th>
                  <th className="px-3 py-2">Baseline</th>
                  <th className="px-3 py-2">Lift</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {sliced.cells.map((c: Payload) => (
                  <tr key={c.value} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-medium text-stone-900">{c.label}</td>
                    <td className="px-3 py-2">{c.n}</td>
                    <td className="px-3 py-2"><Figure m={c.typical as Measured} /></td>
                    <td className="px-3 py-2"><Figure m={c.baseline as Measured} /></td>
                    <td className="px-3 py-2">
                      {c.lift?.state === 'value' ? percentWords(c.lift.value) : <Figure m={c.lift as Measured} />}
                    </td>
                    <td className="px-3 py-2"><Band state={c.band} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* The three buckets that keep the arithmetic honest and visible. */}
      <div className="grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <Bucket title="Born before the engine" bucket={sliced?.born_before_the_engine} />
        <Bucket title="Unplanned posts" bucket={sliced?.unplanned} />
        <Bucket title="Not comparable" bucket={sliced?.not_comparable} />
      </div>
    </div>
  );
}

function Bucket({ title, bucket }: { title: string; bucket?: Payload }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="font-medium text-stone-700">{title}</div>
      <div className="mt-1">{bucket?.count ?? 0}</div>
      {bucket?.words ? <div className="mt-1 text-stone-500">{bucket.words}</div> : null}
    </div>
  );
}

// ── Scorecard ────────────────────────────────────────────────────────────────

export function ScorecardTab({ payload }: { payload: Payload }) {
  const cards = payload.cards ?? [];
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={payload.coverage as Coverage} />
      {cards.length === 0
        ? <Empty>No pillars are set up on this profile yet.</Empty>
        : cards.map((c: Payload) => (
          <div key={c.pillar_id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-stone-900">{c.name}</div>
                <div className="text-xs text-stone-500">job: {c.job ?? 'not set'}</div>
              </div>
              <Band state={c.state} />
            </div>
            {c.purpose ? <p className="mt-2 text-sm italic text-stone-600">{c.purpose}</p> : null}

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-stone-500">Quantity</dt><dd>{c.quantity.words}</dd></div>
              <div><dt className="text-xs uppercase text-stone-500">Judged on</dt><dd>{c.judged_on}</dd></div>
              <div><dt className="text-xs uppercase text-stone-500">Typical</dt><dd><Figure m={c.typical as Measured} /></dd></div>
              <div><dt className="text-xs uppercase text-stone-500">Baseline</dt><dd><Figure m={c.baseline as Measured} /></dd></div>
              <div>
                <dt className="text-xs uppercase text-stone-500">Lift</dt>
                <dd>{c.lift?.state === 'value' ? percentWords(c.lift.value) : <Figure m={c.lift as Measured} />}</dd>
              </div>
              <div><dt className="text-xs uppercase text-stone-500">Coverage</dt><dd>{c.coverage.words}</dd></div>
            </dl>

            {c.blocked_reason ? (
              <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">{c.blocked_reason}</p>
            ) : null}
            {c.state === 'too-early' ? <div className="mt-3"><TooEarly owed={c.sufficiency?.owed} /></div> : null}
            <ShowMyWorking>{c.show_my_working}</ShowMyWorking>
          </div>
        ))}
    </div>
  );
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export function FunnelTab({ payload }: { payload: Payload }) {
  const chain = payload.funnel;
  if (!chain) return <Empty>Nothing collected for this period yet.</Empty>;
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={chain.coverage as Coverage} />

      {chain.months.length === 0
        ? <Empty>No account readings for this period.</Empty>
        : chain.months.map((m: Payload) => (
          <div key={m.month} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-sm font-semibold text-stone-900">{m.month}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {m.steps.map((s: Payload) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="text-stone-600">{s.label}</span>
                  <Figure m={s.value as Measured} />
                </li>
              ))}
            </ul>
          </div>
        ))}

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
        <div className="text-xs uppercase tracking-wide text-stone-500">Brand building</div>
        <p className="mt-1">{chain.brand_building.words}</p>
      </div>

      {/* The wall: attributed outcomes sit beside the funnel, never inside it. */}
      <div className="rounded-lg border border-stone-300 bg-white p-4">
        <div className="text-sm font-semibold text-stone-900">{chain.outcomes.heading}</div>
        {chain.outcomes.rows.length === 0
          ? <p className="mt-2 text-sm text-stone-500">Nothing recorded for this period.</p>
          : (
            <ul className="mt-2 space-y-2 text-sm">
              {chain.outcomes.rows.map((r: Payload) => (
                <li key={r.id} className="rounded-md bg-stone-50 px-3 py-2">
                  <span className={r.status === 'declared' ? 'text-stone-900' : 'text-stone-500'}>{r.words}</span>
                </li>
              ))}
            </ul>
          )}
        <p className="mt-3 text-xs text-stone-500">{chain.outcomes.soft_signals_note}</p>
      </div>
    </div>
  );
}

// ── Compare ──────────────────────────────────────────────────────────────────

export function CompareTab({
  payload, selected, onToggle,
}: {
  payload: Payload;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const preview = payload.preview;
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={payload.coverage as Coverage} />

      <SectionTitle>Pick two or more</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {(payload.selectable ?? []).map((p: Payload) => (
          <button
            key={p.piece_id}
            type="button"
            onClick={() => onToggle(p.piece_id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${
              selected.includes(p.piece_id)
                ? 'border-stone-800 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-800'
            }`}
          >
            <div className="font-medium">{p.title || p.piece_id}</div>
            <div className="text-xs opacity-70">{p.published}</div>
          </button>
        ))}
      </div>

      {preview ? (
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <div className="font-semibold text-stone-900">
            {preview.entry.state === 'not-enough-comparable-data'
              ? 'Not enough comparable data'
              : preview.entry.verdict?.words ?? 'Nothing to say yet'}
          </div>
          {preview.missing ? <p className="mt-1 text-stone-600">{preview.missing}</p> : null}
          <p className="mt-2 text-stone-600">{preview.age_line}</p>
          <p className="mt-1 text-stone-600">{preview.confounder_line}</p>
          {preview.plan_mismatch ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">{preview.plan_mismatch}</p>
          ) : null}
          <p className="mt-2 text-xs text-stone-500">
            Held: {preview.entry.held_variables.join(', ') || 'nothing'}. Changed: {preview.entry.changed_variable}.
          </p>
        </div>
      ) : (
        <Empty>Pick two pieces to compare them.</Empty>
      )}

      <SectionTitle>Saved comparisons</SectionTitle>
      {(payload.saved ?? []).length === 0
        ? <Empty>None yet.</Empty>
        : (
          <ul className="space-y-2 text-sm">
            {payload.saved.map((c: Payload) => (
              <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="font-medium text-stone-900">{c.hypothesis || 'No hypothesis written'}</div>
                <div className="text-xs text-stone-500">
                  {c.planned ? 'Planned. ' : ''}{c.state}{c.planned_status ? `. ${c.planned_status.owed}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────

export function GoalsTab({ payload }: { payload: Payload }) {
  const cards = payload.goals ?? [];
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={payload.coverage as Coverage} />
      {cards.length === 0
        ? <Empty>No goals are set on this profile yet.</Empty>
        : cards.map((g: Payload) => (
          <div key={g.goal_id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-900">{g.name}</span>
              <span className="text-xs uppercase tracking-wide text-stone-500">{g.state}</span>
            </div>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-stone-500">Target</dt>
                <dd>{g.target === 'direction-only' ? 'Direction only' : g.target ? `${g.target.value} this ${g.target.period}` : 'Not set'}</dd>
              </div>
              <div><dt className="text-xs uppercase text-stone-500">Actual</dt><dd><Figure m={g.actual as Measured} /></dd></div>
              {g.pace ? <div><dt className="text-xs uppercase text-stone-500">Pace</dt><dd>{g.pace.words}</dd></div> : null}
              <div><dt className="text-xs uppercase text-stone-500">Coverage</dt><dd>{g.coverage.words}</dd></div>
            </dl>
            <p className="mt-2 text-stone-600">{g.words}</p>
            {g.proxy ? <p className="mt-1 text-xs font-medium text-amber-700">This is a proxy, not the metric itself.</p> : null}
          </div>
        ))}
    </div>
  );
}

// ── Verdicts ─────────────────────────────────────────────────────────────────

export function VerdictsTab({ payload }: { payload: Payload }) {
  const verdicts = payload.verdicts ?? [];
  const digests = payload.digests ?? [];
  return (
    <div className="space-y-4">
      {verdicts.length === 0
        ? <Empty>No verdict has run on this profile yet. The first one lands after a full cycle.</Empty>
        : verdicts.map((v: Payload) => (
          <div key={v.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-900">{v.rendered_words.headline}</span>
              <span className="text-xs uppercase tracking-wide text-stone-500">{v.cycle}</span>
            </div>
            {v.words_are_computed ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                These words were written by the engine&apos;s own code. The written summary is off, missing a key, or did not pass the checks.
              </p>
            ) : null}
            <p className="mt-2 text-stone-700">{v.rendered_words.coverage_note}</p>
            <ul className="mt-2 space-y-1">
              {v.rendered_words.patterns.map((p: Payload, i: number) => (
                <li key={i} className="text-stone-700">{p.words}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-md bg-stone-50 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-stone-500">
                Is doing more of this the right call
              </div>
              <div className="mt-1 font-semibold text-stone-900">{v.rendered_words.call.right_call}</div>
              <p className="mt-1 text-stone-700">{v.rendered_words.call.words}</p>
            </div>
            <p className="mt-2 text-xs text-stone-500">{v.rendered_words.cannot_say_note}</p>
          </div>
        ))}

      <SectionTitle>Digests</SectionTitle>
      {digests.length === 0
        ? <Empty>No digest has been written yet.</Empty>
        : digests.map((d: Payload) => (
          <div key={d.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-900">{d.kind}</span>
              <span className="text-xs text-stone-500">{d.period_start} to {d.period_end}</span>
            </div>
            {d.sections.map((s: Payload) => (
              <div key={s.id} className="mt-2">
                <div className="text-xs uppercase tracking-wide text-stone-500">{s.heading}</div>
                <ul className="mt-1 space-y-1 text-stone-700">
                  {s.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            ))}
            {d.kind === 'client-publication' ? (
              <p className="mt-3 text-xs font-medium text-stone-600">
                {d.published
                  ? `Published ${String(d.approved_at ?? '').slice(0, 10)}.`
                  : 'Not published. The client sees nothing until you approve it.'}
              </p>
            ) : null}
          </div>
        ))}
    </div>
  );
}

// ── Health ───────────────────────────────────────────────────────────────────

export function HealthTab({ payload }: { payload: Payload }) {
  const health = payload.health;
  if (!health) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <div className="space-y-4">
      <CoverageBanner coverage={payload.coverage as Coverage} />

      <SectionTitle>Channels</SectionTitle>
      {health.channels.length === 0
        ? <Empty>No channel is connected on this profile.</Empty>
        : health.channels.map((c: Payload) => (
          <div key={c.channel_id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
            <div className="font-medium text-stone-900">{c.account_handle || c.channel_id}</div>
            <div className="text-xs text-stone-500">
              {c.platform}. Connection: {c.connection_status}. Last successful sync: {c.last_successful_sync ?? 'never'}.
            </div>
          </div>
        ))}

      <SectionTitle>Coverage gaps</SectionTitle>
      {health.gaps.length === 0
        ? <Empty>No gaps in this period.</Empty>
        : (
          <ul className="space-y-2 text-sm">
            {health.gaps.map((g: Payload, i: number) => (
              <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                {g.from} to {g.to}. {reasonWords(g.reason)}
              </li>
            ))}
          </ul>
        )}

      <SectionTitle>Recent runs</SectionTitle>
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Trigger</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Seen</th>
              <th className="px-3 py-2">Observed</th>
              <th className="px-3 py-2">Finished</th>
            </tr>
          </thead>
          <tbody>
            {health.runs.map((r: Payload) => (
              <tr key={r.run_id} className="border-t border-stone-100">
                <td className="px-3 py-2">{String(r.started_at).slice(0, 16).replace('T', ' ')}</td>
                <td className="px-3 py-2">{r.trigger}</td>
                <td className="px-3 py-2">{r.connection_status}</td>
                <td className="px-3 py-2">{r.posts_seen}</td>
                <td className="px-3 py-2">{r.posts_observed}</td>
                <td className="px-3 py-2">{r.completed ? 'yes' : 'partial'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-500">{health.update_now_note}</p>
    </div>
  );
}

function reasonWords(reason: string): string {
  switch (reason) {
    case 'sync-stalled': return 'The pipe stopped.';
    case 'switched-off': return 'You turned this off.';
    case 'not-yet-tracked': return 'Before we started collecting.';
    case 'platform-error': return 'The platform refused us.';
    case 'not-connected': return 'The account was not connected.';
    default: return 'We do not know why we stopped.';
  }
}

export { formatNumber };
