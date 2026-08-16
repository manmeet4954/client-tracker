'use client';

// Strategy room → The brand. A draft, 2026-08-11.
//
// HER BRIEF: Strategy should answer "what the brand is all about, what we have
// decided, how the brand will proceed, what it uses as USPs, what the client
// profiles are, visual and content strategy, audience, deliverables, pillars",
// and it "should be presented simply rather than with so many things."
//
// So this is the brand READ AS A DOCUMENT: five headings, top to bottom, each
// row showing what was decided in a sentence rather than a form. Every value
// comes from the same store the existing screens write, so this is a second
// VIEW and never a second copy.
//
// A DRAFT ON PURPOSE. Her instruction was "show me a draft first", so this is
// added beside Facts and Decide rather than replacing them. Nothing is removed
// until she has looked. When she says go, Facts and Decide retire into this.
//
// Editing: the twelve that already had editors keep them, in Decide, and each
// row goes there. USPs and Demographics are new and have no editor anywhere
// else, so they type in place here. That split is temporary and admitted rather
// than hidden.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import {
  readStrategy, strategyLocked, writeStrategy, type StrategyValue,
} from '@/lib/strategy/derivation';
import { rowStatus, type InputSpec } from '@/lib/strategy/inputs';
import {
  ADDED_INPUTS, DOCUMENT_SECTIONS, documentLine, sectionGap, sectionInputs,
} from '@/lib/strategy/document';
import type { ProfileBody } from '@/lib/tree/body';

const ADDED_PATHS = ADDED_INPUTS.map(i => i.path);

export default function BrandDocument({ profileId, decideHref, brandHref }: {
  profileId: string;
  /** Where a row goes to be decided. */
  decideHref: string;
  brandHref: string;
}) {
  const { role } = useApp();
  const { client, data } = useClient(profileId);

  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

  const body = data.body;
  if (!body) {
    return <p className="p-8 text-sm text-faint">This profile is not in the new structure yet.</p>;
  }

  const decided = DOCUMENT_SECTIONS
    .flatMap(s => s.paths)
    .filter(p => !!readStrategy(body, p));

  return (
    <div className="w-full max-w-5xl">
      <header className="mb-5">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">
          {client?.name ?? 'The brand'}
        </h2>
        <p className="mt-1.5 text-[13.5px] font-semibold text-muted">{documentLine(decided)}</p>
      </header>

      <div className="space-y-6">
        {DOCUMENT_SECTIONS.map(section => {
          const gap = sectionGap(section, decided);
          return (
            <section key={section.id}>
              <h3 className="font-display text-[16.5px] font-bold tracking-[-.01em] text-text">
                {section.title}
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-faint">{section.answers}</p>
              {gap && <p className="mt-0.5 text-[12.5px] text-muted">{gap}</p>}

              <div className="mt-2.5 space-y-2">
                {sectionInputs(section).map(spec =>
                  ADDED_PATHS.includes(spec.path) ? (
                    <TypedRow key={spec.path} profileId={profileId} body={body} spec={spec} />
                  ) : (
                    <DecidedRow
                      key={spec.path}
                      body={body}
                      spec={spec}
                      href={spec.path.endsWith('visual-branding') ? brandHref : decideHref}
                    />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** One decided row: its label, what it says, and a way through to change it. */
function DecidedRow({ body, spec, href }: { body: ProfileBody; spec: InputSpec; href: string }) {
  const decision = readStrategy(body, spec.path);
  const status = rowStatus(spec, decision as { value: unknown; not_applicable?: boolean } | null);

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-card border border-hairline bg-white p-4 shadow-card hover:border-[rgba(234,71,17,.3)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold uppercase tracking-[.08em] text-faint">
          {spec.label}
        </span>
        {status.decided && status.detail ? (
          <span className="mt-1 block whitespace-pre-wrap text-[14.5px] leading-[1.55] text-text">
            {status.detail}
          </span>
        ) : (
          <span className="mt-1 block text-[14px] leading-[1.55] text-faint">
            {status.state === 'not used here' ? 'Not used for this brand.' : spec.help}
          </span>
        )}
      </span>
      <ChevronRight size={17} strokeWidth={2.2} className="mt-0.5 flex-none text-faint" />
    </Link>
  );
}

/**
 * A row she types straight into: the two her brief named that had no editor
 * anywhere. It writes through `writeStrategy`, exactly as Decide does, so a USP
 * typed here is stored the same way positioning is.
 */
function TypedRow({ profileId, body, spec }: {
  profileId: string; body: ProfileBody; spec: InputSpec;
}) {
  const { dispatch } = useApp();
  const decision = readStrategy(body, spec.path);
  const stored = typeof decision?.value === 'string' ? decision.value : '';
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState('');

  function save(text: string) {
    const value = text.trim();
    if (value === stored.trim()) return;
    const now = new Date().toISOString();
    // The LOCK is the right gate here, and `mayWriteStrategy` is not: that one
    // asks whether the derivation map's sources are curated, and these two rows
    // are deliberately outside the map, so it would refuse every write forever.
    // A locked strategy still refuses, and says so rather than swallowing her
    // typing.
    if (strategyLocked(body)) {
      setRefused('The strategy is locked, so this cannot change here.');
      return;
    }
    const next = writeStrategy(body, spec.path, {
      key: spec.path.split('/').pop() ?? spec.path,
      value,
      reason: `Written on the brand page on ${now.slice(0, 10)}.`,
      sources: [],
      strategy_version: null,
    } as StrategyValue, now);
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    setRefused('');
  }

  return (
    <div className="rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[13px] font-bold uppercase tracking-[.08em] text-faint">{spec.label}</p>
      <textarea
        value={draft ?? stored}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== null) save(draft); setDraft(null); }}
        rows={2}
        placeholder={spec.help}
        className="mt-1.5 w-full resize-y rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-[14.5px] leading-[1.55] text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {refused && <p className="mt-1.5 text-[12.5px] font-semibold text-accent-text">{refused}</p>}
    </div>
  );
}
