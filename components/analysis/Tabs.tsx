'use client';

// The eight screens — spec 27 §5, regrouped by the restructure handoff and
// redressed in the design tokens.
//
// Each one is a WINDOW onto the one computation layer: nothing here computes,
// nothing here queries, and nothing here has its own idea of what a number
// means. Every payload arrives from `/api/analysis` already resolved into the
// four states, and every width, plural and day name is shaped by
// `lib/analysis/groups.ts`, which is tested without React.
//
// Coverage is NOT drawn here. It is the group's first block, once, above
// everything — one thing, one home. A screen reading a different stretch of days
// than the group says so with `CoverageDiffers`, which the group renders.

import {
  Band, Card, DarkButton, Empty, Figure, GhostButton, Kicker, Meter, Metric, MetricGrid, Pill,
  Row, ShowMyWorking, TooEarly,
} from './Shared';
import type { Measured } from './Shared';
import {
  NO_READING, bornLine, canCompare, compareVerdict, countLine, formatDay, formatNumber, goalBar,
  goalValue, meterBar, maxReading, percentWords, pillarRead, selectionLine, sliceRows,
} from '@/lib/analysis/groups';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = Record<string, any>;

// ── Now ──────────────────────────────────────────────────────────────────────

export function NowTab({ payload }: { payload: Payload }) {
  const now = payload.now;
  if (!now) return <Empty>Nothing to show yet.</Empty>;
  const pillars: Payload[] = now.pillars ?? [];
  const moving: Payload[] = now.moving ?? [];
  const pieces: unknown[] = new Array(Number(now.posted) || 0).fill(0);

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="px-5 py-[18px]">
        <p className="text-[13px] leading-[1.55] text-muted">{now.first_block}</p>
        <p className="mt-1.5 text-[15px] text-text">
          {countLine(pieces, 'piece', 'pieces')} out this month so far.
        </p>
      </Card>

      {/* One card per pillar, on the stick that pillar declared. A pillar with
          no collection shows an em dash, never a zero. */}
      {pillars.length > 0 && (
        <MetricGrid>
          {pillars.map((p: Payload) => (
            <Metric key={p.pillar_id} label={p.name} m={p.typical as Measured} coverage={p.coverage} />
          ))}
        </MetricGrid>
      )}

      <Card>
        <div className="px-[18px] pb-3 pt-3.5">
          <Kicker>Anything moving</Kicker>
        </div>
        {moving.length === 0 ? (
          <p className="px-[18px] pb-4 text-[13px] text-faint">
            Nothing has moved far enough from your own normal to call.
          </p>
        ) : (
          moving.map((m: Payload, i: number) => (
            <Row key={i}>
              <span className="flex-1 text-[15px] font-semibold text-text">
                {m.dimension} &ldquo;{m.value}&rdquo;
              </span>
              <span className="text-[12.5px] text-muted">{m.words}</span>
              <Band state={m.band} />
            </Row>
          ))
        )}
      </Card>

      {now.last_verdict ? (
        <Card className="px-5 py-4">
          <Kicker>Last verdict</Kicker>
          <p className="mt-1.5 text-[15px] leading-[1.6] text-text">{now.last_verdict.headline}</p>
        </Card>
      ) : null}
    </div>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────

export function GoalsTab({ payload }: { payload: Payload }) {
  const cards: Payload[] = payload.goals ?? [];
  if (cards.length === 0) return <Empty>No goals are set on this profile yet.</Empty>;
  return (
    <Card className="px-5 py-[18px]">
      <Kicker>Against the target, this month</Kicker>
      <div className="mt-3">
        {cards.map((g: Payload) => {
          const bar = goalBar(g);
          return (
            <div key={g.goal_id} className="border-b border-divider py-2.5 last:border-b-0">
              <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold text-text">{g.name}</span>
                <span className="tabular-nums text-faint">{goalValue(g)}</span>
              </div>
              {bar ? <Meter bar={bar} /> : null}
              {g.words ? <p className="mt-1.5 text-[12.5px] text-muted">{g.words}</p> : null}
              {g.pace ? <p className="text-[12.5px] text-muted">{g.pace.words}</p> : null}
              {g.proxy ? (
                <p className="mt-1 text-[12px] font-semibold text-overdue">
                  This is a proxy, not the metric itself.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Health ───────────────────────────────────────────────────────────────────

export function HealthTab({ payload, fixHref }: { payload: Payload; fixHref?: string }) {
  const health = payload.health;
  if (!health) return <Empty>Nothing recorded yet.</Empty>;
  const channels: Payload[] = health.channels ?? [];
  const gaps: Payload[] = health.gaps ?? [];
  const runs: Payload[] = health.runs ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
          <Kicker>Where the numbers come from</Kicker>
          <span className="text-[12.5px] text-faint">{countLine(channels, 'channel', 'channels')}</span>
        </div>
        {channels.length === 0 ? (
          <p className="px-[18px] pb-4 text-[13px] text-faint">No channel is connected on this profile.</p>
        ) : (
          channels.map((c: Payload) => (
            <Row key={c.channel_id}>
              <span className="flex-1 text-[15px] font-semibold text-text">
                {c.account_handle || c.channel_id}
              </span>
              <span className="text-[12.5px] text-muted">
                {c.platform}. Last worked {c.last_successful_sync ? formatDay(String(c.last_successful_sync)) : 'never'}.
              </span>
              <Pill tone={c.connection_status === 'connected' ? 'positive' : 'attention'}>
                {c.connection_status}
              </Pill>
            </Row>
          ))
        )}
        {fixHref ? (
          <div className="border-t border-divider px-[18px] py-3.5">
            <GhostButton href={fixHref}>Fix the connection</GhostButton>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
          <Kicker>Days we did not collect</Kicker>
          <span className="text-[12.5px] text-faint">{countLine(gaps, 'stretch', 'stretches')}</span>
        </div>
        {gaps.length === 0 ? (
          <p className="px-[18px] pb-4 text-[13px] text-faint">No gaps in this period.</p>
        ) : (
          gaps.map((g: Payload, i: number) => (
            <Row key={i}>
              <span className="flex-1 text-[14px] text-text">
                {formatDay(g.from)} to {formatDay(g.to)}
              </span>
              <span className="text-[12.5px] text-muted">{reasonWords(g.reason)}</span>
            </Row>
          ))
        )}
      </Card>

      {runs.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
            <Kicker>Recent runs</Kicker>
            <span className="text-[12.5px] text-faint">{countLine(runs, 'run', 'runs')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead className="text-left text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
                <tr>
                  <th className="px-[18px] py-2 font-bold">Started</th>
                  <th className="px-3 py-2 font-bold">Trigger</th>
                  <th className="px-3 py-2 font-bold">Connection</th>
                  <th className="px-3 py-2 font-bold">Seen</th>
                  <th className="px-3 py-2 font-bold">Read</th>
                  <th className="px-3 py-2 font-bold">Finished</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r: Payload) => (
                  <tr key={r.run_id} className="border-t border-divider">
                    <td className="px-[18px] py-2.5 tabular-nums text-text">
                      {String(r.started_at).slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{r.trigger}</td>
                    <td className="px-3 py-2.5 text-muted">{r.connection_status}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{r.posts_seen}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{r.posts_observed}</td>
                    <td className="px-3 py-2.5 text-muted">{r.completed ? 'yes' : 'partial'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {health.update_now_note ? (
        <p className="text-[12.5px] text-faint">{health.update_now_note}</p>
      ) : null}
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

// ── Slices ───────────────────────────────────────────────────────────────────

function Chip(
  { on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-[5px] text-[12.5px] font-semibold ${
        on ? 'bg-ink text-white' : 'bg-control text-muted'
      }`}
    >
      {children}
    </button>
  );
}

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
  const dimensions: Payload[] = payload.dimensions ?? [];
  const rows = sliceRows(sliced?.cells);

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="px-5 py-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <Kicker>Slice by</Kicker>
          <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto md:flex-wrap">
            {dimensions.map((d: Payload) => (
              <Chip key={d.id} on={d.id === dimension} onClick={() => onDimension(d.id)}>
                {d.label}{d.fallback ? ' (read)' : ''}
              </Chip>
            ))}
          </div>
        </div>

        {dimensions.length > 1 && (
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <Kicker>Crossed with</Kicker>
            <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto md:flex-wrap">
              <Chip on={!cross} onClick={() => onCross('')}>Nothing</Chip>
              {dimensions.filter((d: Payload) => d.id !== dimension).map((d: Payload) => (
                <Chip key={d.id} on={d.id === cross} onClick={() => onCross(d.id)}>{d.label}</Chip>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <Empty>Nothing posted in this period carries that parameter yet.</Empty>
        ) : (
          rows.map(r => (
            <div key={r.key} className="border-b border-divider py-2.5 last:border-b-0">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-text">{r.label}</span>
                <span className="flex items-center gap-2.5">
                  <span className="text-[12.5px] text-faint">{r.count}</span>
                  <span className="tabular-nums text-faint">{r.figure}</span>
                </span>
              </div>
              <Meter bar={r.bar} />
            </div>
          ))
        )}
      </Card>

      {/* The three buckets that keep the arithmetic honest and visible. Each
          count is counted from the ids that bucket holds. */}
      <div className="grid gap-3 md:grid-cols-3">
        <Bucket
          title="Born before the engine"
          ids={sliced?.born_before_the_engine?.piece_ids}
          words={sliced?.born_before_the_engine?.words}
        />
        <Bucket
          title="Posted without a plan"
          ids={sliced?.unplanned?.platform_post_ids}
          words={sliced?.unplanned?.words}
        />
        <Bucket
          title="Not comparable"
          ids={sliced?.not_comparable?.piece_ids}
          words={sliced?.not_comparable?.words}
        />
      </div>
    </div>
  );
}

function Bucket({ title, ids, words }: { title: string; ids?: unknown[]; words?: string }) {
  return (
    <Card className="px-[18px] py-3.5">
      <div className="text-[12.5px] font-semibold text-text">{title}</div>
      <div className="mt-1 font-display text-[19px] font-bold tabular-nums text-text">
        {countLine(ids, 'piece', 'pieces')}
      </div>
      {words ? <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">{words}</p> : null}
    </Card>
  );
}

// ── Scorecard ────────────────────────────────────────────────────────────────

export function ScorecardTab({ payload }: { payload: Payload }) {
  const cards: Payload[] = payload.cards ?? [];
  if (cards.length === 0) return <Empty>No pillars are set up on this profile yet.</Empty>;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
        <Kicker>Each pillar, on its own job</Kicker>
        <span className="text-[12.5px] text-faint">{countLine(cards, 'pillar', 'pillars')}</span>
      </div>
      {cards.map((c: Payload) => {
        const read = pillarRead(c);
        return (
          <div key={c.pillar_id} className="border-t border-divider px-[18px] py-3.5">
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="flex-1 text-[15px] font-semibold text-text">{c.name}</span>
              <span className="text-[13px] text-muted">{c.job ?? 'no job set'}</span>
              <Pill tone={read.tone}>{read.words}</Pill>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
              <span>{c.quantity?.words}</span>
              <span>judged on {c.judged_on}</span>
              <span>
                typical <Figure m={c.typical as Measured} />
              </span>
              <span>
                {c.lift?.state === 'value'
                  ? `lift ${percentWords(c.lift.value)}`
                  : <>lift <Figure m={c.lift as Measured} /></>}
              </span>
            </div>

            {c.blocked_reason ? (
              <p className="mt-2 rounded-xl bg-control px-3.5 py-2.5 text-[13px] text-muted">
                {c.blocked_reason}
              </p>
            ) : null}
            {c.state === 'too-early' ? (
              <div className="mt-2"><TooEarly owed={c.sufficiency?.owed} /></div>
            ) : null}
            <ShowMyWorking>{c.show_my_working}</ShowMyWorking>
          </div>
        );
      })}
    </Card>
  );
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export function FunnelTab({ payload }: { payload: Payload }) {
  const chain = payload.funnel;
  if (!chain) return <Empty>Nothing collected for this period yet.</Empty>;
  const months: Payload[] = chain.months ?? [];
  const rows: Payload[] = chain.outcomes?.rows ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      {months.length === 0
        ? <Empty>No account readings for this period.</Empty>
        : months.map((m: Payload) => {
          const steps: Payload[] = m.steps ?? [];
          const max = maxReading(steps.map(s => ({ value: s.value as Measured })));
          return (
            <Card key={m.month} className="px-5 py-[18px]">
              <Kicker>{m.month}</Kicker>
              <div className="mt-3">
                {steps.map((s: Payload) => (
                  <div key={s.id} className="border-b border-divider py-2.5 last:border-b-0">
                    <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold text-text">{s.label}</span>
                      <span className="tabular-nums text-faint">
                        {s.value?.state === 'value' ? formatNumber(s.value.value) : NO_READING}
                      </span>
                    </div>
                    <Meter bar={meterBar(s.value as Measured, max)} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

      {chain.brand_building?.words ? (
        <Card className="px-5 py-4">
          <Kicker>Brand building</Kicker>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted">{chain.brand_building.words}</p>
        </Card>
      ) : null}

      {/* The wall: attributed outcomes sit beside the funnel, never inside it. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
          <span className="text-[15px] font-semibold text-text">{chain.outcomes?.heading}</span>
          <span className="text-[12.5px] text-faint">{countLine(rows, 'outcome', 'outcomes')}</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-[18px] pb-4 text-[13px] text-faint">Nothing recorded for this period.</p>
        ) : (
          rows.map((r: Payload) => (
            <Row key={r.id}>
              <span className={`flex-1 text-[14px] ${r.status === 'declared' ? 'text-text' : 'text-faint'}`}>
                {r.words}
              </span>
            </Row>
          ))
        )}
        {chain.outcomes?.soft_signals_note ? (
          <p className="border-t border-divider px-[18px] py-3 text-[12.5px] text-faint">
            {chain.outcomes.soft_signals_note}
          </p>
        ) : null}
      </Card>
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
  const selectable: Payload[] = payload.selectable ?? [];
  const preview = payload.preview;
  const verdict = compareVerdict(preview);
  const saved: Payload[] = payload.saved ?? [];
  const chosen = selectable.filter(p => selected.includes(p.piece_id));

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="px-5 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Kicker>Two or more, side by side</Kicker>
          <span className="text-[12.5px] text-faint">{selectionLine(selected)}</span>
        </div>
        {selectable.length === 0 ? (
          <div className="mt-3"><Empty>Nothing in this period has a reading to compare.</Empty></div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {selectable.map((p: Payload) => {
              const on = selected.includes(p.piece_id);
              return (
                <button
                  key={p.piece_id}
                  type="button"
                  onClick={() => onToggle(p.piece_id)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left ${
                    on ? 'border-ink bg-ink text-white' : 'border-hairline bg-surface text-text'
                  }`}
                >
                  <div className="text-sm font-semibold">{p.title || p.piece_id}</div>
                  <div className={`text-[12px] ${on ? 'text-white/70' : 'text-faint'}`}>
                    {p.published ? formatDay(String(p.published)) : 'not published'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Each piece shows how it was born ABOVE its numbers. That is the point:
          two readings side by side mean nothing until you can see what was
          different about them. */}
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {chosen.map((p: Payload) => (
            <Card key={p.piece_id} className="min-w-[230px] flex-1 px-[18px] py-[18px]">
              <div className="text-[15.5px] font-semibold leading-[1.3] text-text">
                {p.title || p.piece_id}
              </div>
              <div className="mt-1 text-[12.5px] text-faint">
                {bornLine(p.costume, p.seed_title)}
              </div>
              <div className="mt-3.5 flex flex-col gap-2.5">
                {(p.readings ?? []).map((r: Payload, i: number) => (
                  <div key={i} className="flex justify-between border-b border-divider pb-[7px] text-[13.5px]">
                    <span className="text-muted">{r.label}</span>
                    <span className="font-semibold tabular-nums text-text">
                      {r.value?.state === 'value' ? formatNumber(r.value.value) : NO_READING}
                    </span>
                  </div>
                ))}
                {ageOf(preview, p.piece_id) !== undefined ? (
                  <div className="flex justify-between text-[13.5px]">
                    <span className="text-muted">Read at</span>
                    <span className="font-semibold tabular-nums text-text">
                      {ageOf(preview, p.piece_id)}h old
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!canCompare(selected) ? (
        <Empty>Pick two pieces to compare them.</Empty>
      ) : verdict ? (
        <Card className="px-5 py-[18px]">
          <Kicker>{verdict.enough ? 'The call, in words' : 'No call'}</Kicker>
          <p className="mt-2.5 text-[15px] leading-[1.65] text-text">{verdict.words}</p>
          {verdict.detail ? <p className="mt-1.5 text-[13px] text-muted">{verdict.detail}</p> : null}
          {preview?.age_line ? <p className="mt-2 text-[12.5px] text-faint">{preview.age_line}</p> : null}
          {preview?.confounder_line ? (
            <p className="mt-1 text-[12.5px] text-faint">{preview.confounder_line}</p>
          ) : null}
          {preview?.plan_mismatch ? (
            <p className="mt-2 rounded-xl bg-[rgba(234,71,17,.07)] px-3.5 py-2.5 text-[13px] text-accent-text">
              {preview.plan_mismatch}
            </p>
          ) : null}
        </Card>
      ) : (
        <Empty>Reading those two.</Empty>
      )}

      {saved.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
            <Kicker>Saved comparisons</Kicker>
            <span className="text-[12.5px] text-faint">{countLine(saved, 'comparison', 'comparisons')}</span>
          </div>
          {saved.map((c: Payload) => (
            <Row key={c.id}>
              <span className="flex-1 text-[14px] font-semibold text-text">
                {c.hypothesis || 'No hypothesis written'}
              </span>
              <span className="text-[12.5px] text-muted">
                {c.planned ? 'Planned. ' : ''}{c.state}{c.planned_status?.owed ? `. ${c.planned_status.owed}` : ''}
              </span>
            </Row>
          ))}
        </Card>
      )}
    </div>
  );
}

function ageOf(preview: Payload | undefined, pieceId: string): number | undefined {
  const ages: Payload[] = preview?.entry?.ages ?? [];
  return ages.find(a => a.piece_id === pieceId)?.age_hours;
}

// ── Verdicts ─────────────────────────────────────────────────────────────────

export function VerdictsTab({ payload, engineHref }: { payload: Payload; engineHref?: string }) {
  const verdicts: Payload[] = payload.verdicts ?? [];
  const digests: Payload[] = payload.digests ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      {verdicts.length === 0 ? (
        <Empty>No verdict has run on this profile yet. The first one lands after a full cycle.</Empty>
      ) : (
        verdicts.map((v: Payload) => {
          const patterns: Payload[] = v.rendered_words?.patterns ?? [];
          return (
            <Card key={v.id} className="px-5 py-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Kicker>The {v.cycle} call, in words</Kicker>
                <span className="text-[12.5px] text-faint">
                  {countLine(patterns, 'pattern', 'patterns')}
                </span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold leading-[1.6] text-text">
                {v.rendered_words?.headline}
              </p>
              {v.words_are_computed ? (
                <p className="mt-2 rounded-xl bg-[rgba(234,71,17,.07)] px-3.5 py-2.5 text-[12.5px] text-accent-text">
                  These words were written by the engine&apos;s own code, not by a model.
                </p>
              ) : null}
              {v.rendered_words?.coverage_note ? (
                <p className="mt-2 text-[13px] text-muted">{v.rendered_words.coverage_note}</p>
              ) : null}
              {patterns.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {patterns.map((p: Payload, i: number) => (
                    <li key={i} className="text-[14px] leading-[1.6] text-text">{p.words}</li>
                  ))}
                </ul>
              )}
              {v.rendered_words?.call ? (
                <div className="mt-3 rounded-xl bg-control px-3.5 py-3">
                  <Kicker>Is doing more of this the right call</Kicker>
                  <div className="mt-1 text-sm font-semibold text-text">
                    {v.rendered_words.call.right_call}
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.55] text-muted">
                    {v.rendered_words.call.words}
                  </p>
                </div>
              ) : null}
              {v.rendered_words?.cannot_say_note ? (
                <p className="mt-2 text-[12.5px] text-faint">{v.rendered_words.cannot_say_note}</p>
              ) : null}
              {engineHref ? (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <DarkButton href={engineHref}>Send this back to Engine</DarkButton>
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      {digests.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-3.5">
            <Kicker>Written up</Kicker>
            <span className="text-[12.5px] text-faint">{countLine(digests, 'digest', 'digests')}</span>
          </div>
          {digests.map((d: Payload) => (
            <div key={d.id} className="border-t border-divider px-[18px] py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text">{d.kind}</span>
                <span className="text-[12px] tabular-nums text-faint">
                  {formatDay(d.period_start)} to {formatDay(d.period_end)}
                </span>
              </div>
              {(d.sections ?? []).map((s: Payload) => (
                <div key={s.id} className="mt-2">
                  <Kicker>{s.heading}</Kicker>
                  <ul className="mt-1 flex flex-col gap-1 text-[13px] leading-[1.55] text-muted">
                    {(s.lines ?? []).map((l: string, i: number) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              ))}
              {d.kind === 'client-publication' ? (
                <p className="mt-2.5 text-[12.5px] font-semibold text-muted">
                  {d.published
                    ? `Published ${formatDay(String(d.approved_at ?? '').slice(0, 10))}.`
                    : 'Not published. The client sees nothing until you approve it.'}
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export { formatNumber };
