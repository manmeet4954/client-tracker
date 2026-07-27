'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Check, Wand2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { Confidence } from '@/lib/tree/objects';
import { PARAMETERS, parameterFolders, parametersAt, type ParameterRecord } from '@/lib/intake/parameters';
import { answersFor, curateParameter, curationHistory, readCurated, CurationRefused } from '@/lib/intake/curate';
import { markCurated } from '@/lib/intake/rounds';
import { mapRoundZero } from '@/lib/intake/roundZero';
import { readersOfParameter } from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';

const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'confirmed', label: 'they said it plainly' },
  { id: 'inferred', label: 'I read it out of what they said' },
  { id: 'unknown', label: 'still a gap' },
];

/**
 * The curation pass (spec 22 §7): raw on the left, the curated value on the
 * right, one parameter at a time. She works parameter by parameter, not answer
 * by answer, because the folders are the truth and answers are evidence for them.
 *
 * The rule the surface holds: no curated value without its source.
 */
export default function CurationView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const [note, setNote] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const body = data.body;
  const save = (next: ProfileBody, message = '') => {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    setNote(message);
  };

  const folders = useMemo(() => parameterFolders(), []);

  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const hersProfile = client?.ownerKind === 'hers';
  const done = PARAMETERS.filter(p => !p.curates_to && readCurated(body, p.id)).length;
  const total = PARAMETERS.filter(p => !p.curates_to).length;

  function runMapping() {
    const result = mapRoundZero(body!);
    save(
      result.body,
      `Read ${result.proposals.length} old answers. ${result.proposals.filter(p => p.parameter_id).length} of them ` +
      `look like a parameter, ${result.unmapped.length} do not. They are all in your list to sort. ` +
      'Nothing was written as a value.',
    );
  }

  function curate(p: ParameterRecord, value: string, sources: string[], confidence: Confidence) {
    const now = new Date().toISOString();
    try {
      let next = curateParameter(body!, {
        parameter_id: p.id, value, source_refs: sources, curator: 'owner', confidence, now,
      });
      next = markCurated(next, p.id, now);
      save(next, '');
    } catch (e) {
      setNote(e instanceof CurationRefused ? e.message : 'That could not be saved.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <BookOpen size={18} className="text-stone-500" />
            Curation
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            What they said on the left, what we know on the right. {done} of {total} written.
            {hersProfile && ' This is one of yours, so you can write straight into it.'}
          </p>
        </div>
        <button onClick={runMapping}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
          <Wand2 size={15} /> Read the old answers
        </button>
      </header>

      {note && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{note}</div>
      )}

      {body.sort_queue.length > 0 && (
        <details className="mb-5 bg-white border border-stone-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-stone-800 cursor-pointer">
            {body.sort_queue.length} things waiting on you
          </summary>
          <ul className="px-4 pb-3 space-y-2">
            {body.sort_queue.map((q, i) => (
              <li key={i} className="text-sm text-stone-600">
                <span className="text-stone-400">{q.path}</span><br />{q.question}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ClientIdeas body={body} />

      <div className="space-y-6">
        {folders.filter(f => parametersAt(f).some(p => !p.curates_to)).map(folder => (
          <section key={folder}>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">{folderLabel(folder)}</h3>
            <div className="space-y-2">
              {parametersAt(folder).filter(p => !p.curates_to).map(p => (
                <ParameterCard
                  key={p.id}
                  parameter={p}
                  body={body}
                  open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onCurate={(value, sources, confidence) => curate(p, value, sources, confidence)}
                  hersProfile={hersProfile}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * §7.5, the one lane that is not a context parameter. A client who brings ideas
 * gives them at intake, and she reads the idea and births a seed from it in the
 * engine. Nothing here writes a seed: that door opens once strategy locks.
 */
function ClientIdeas({ body }: { body: ProfileBody }) {
  const ideas = answersFor(body, 'client-ideas');
  if (ideas.length === 0) return null;
  return (
    <section className="mb-6 bg-white border border-stone-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-stone-900">Things they want us to talk about</h3>
      <p className="text-xs text-stone-500 mt-1">
        These are not facts about them, so they are not curated here. You read them in the engine and
        turn the ones worth it into seeds.
      </p>
      <ul className="mt-3 space-y-2">
        {ideas.map(a => (
          <li key={a.id} className="text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2">
            {a.value}
            <span className="block text-xs text-stone-400 mt-1">round {a.round_version}, {a.by}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function folderLabel(path: string): string {
  const last = path.split('/').pop() ?? path;
  const area = path.includes('personal-details') ? 'The person' : path.includes('business-details') ? 'The business' : 'Intake';
  return `${area}: ${last.replace(/-/g, ' ')}`;
}

function ParameterCard({ parameter, body, open, onToggle, onCurate, hersProfile }: {
  parameter: ParameterRecord;
  body: ProfileBody;
  open: boolean;
  onToggle: () => void;
  onCurate: (value: string, sources: string[], confidence: Confidence) => void;
  hersProfile: boolean;
}) {
  const raw = answersFor(body, parameter.id);
  const current = readCurated(body, parameter.id);
  const history = curationHistory(body, parameter.id);
  const readers = readersOfParameter(parameter.id);

  const [value, setValue] = useState(current ? String(current.value ?? '') : '');
  const [picked, setPicked] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence>('confirmed');
  const [ownerNote, setOwnerNote] = useState('');

  const sources = picked.length ? picked : ownerNote.trim() ? [`owner-direct:${ownerNote.trim()}`] : [];

  return (
    <div className="bg-white border border-stone-200 rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-stone-900 truncate">{parameter.label}</span>
          <span className="block text-xs text-stone-400 truncate">
            {current ? String(current.value ?? '') : `${raw.length} answers, nothing written yet`}
          </span>
        </span>
        {current
          ? <Check size={16} className="text-emerald-600 shrink-0" />
          : <span className="text-xs text-stone-400 shrink-0">{open ? 'close' : 'open'}</span>}
      </button>

      {open && (
        <div className="border-t border-stone-100 grid md:grid-cols-2 gap-4 p-4">
          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">What they said</p>
            {raw.length === 0 && <p className="text-sm text-stone-400">Nothing yet. Nobody has answered this.</p>}
            {raw.map(a => (
              <label key={a.id} className="flex gap-2 items-start mb-2 text-sm text-stone-700">
                <input type="checkbox" className="mt-1"
                  checked={picked.includes(a.id)}
                  onChange={e => setPicked(v => e.target.checked ? [...v, a.id] : v.filter(x => x !== a.id))} />
                <span>
                  {a.kind === 'skipped' ? <em className="text-stone-400">They chose not to answer.</em> : a.value}
                  <span className="block text-xs text-stone-400">round {a.round_version}, {a.by}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-stone-400 mt-3">{parameter.question}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">What we know</p>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              rows={3}
              placeholder="Write the value in your words"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400"
            />
            {parameter.options && (
              <p className="text-xs text-stone-400 mt-1">List: {parameter.options}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONFIDENCE.map(c => (
                <button key={c.id} onClick={() => setConfidence(c.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    confidence === c.id ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>

            {picked.length === 0 && (
              <input
                value={ownerNote}
                onChange={e => setOwnerNote(e.target.value)}
                placeholder={hersProfile ? 'Where this came from' : 'Where this came from, if not from an answer'}
                className="mt-2 w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400"
              />
            )}

            <button
              onClick={() => onCurate(value, sources, confidence)}
              disabled={!value.trim() || sources.length === 0}
              className="mt-3 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40"
            >
              {current ? 'Replace it' : 'Write it'}
            </button>
            {sources.length === 0 && (
              <p className="text-xs text-stone-400 mt-2">
                Pick the answer this came from, or say where it came from. Nothing is written without that.
              </p>
            )}

            {history.length > 1 && (
              <details className="mt-3">
                <summary className="text-xs text-stone-500 cursor-pointer">{history.length} readings kept</summary>
                <ul className="mt-1 space-y-1">
                  {history.map((h, i) => (
                    <li key={i} className="text-xs text-stone-500">
                      {String(h.value ?? '')} <span className="text-stone-400">({h.provenance.at.slice(0, 10)})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {readers.length > 0 && (
              <p className="text-xs text-stone-400 mt-3">
                Feeds: {readers.map(r => r.split('/').pop()).join(', ')}
              </p>
            )}
            {parameter.reader === 'none-by-design' && (
              <p className="text-xs text-stone-400 mt-3">No strategy decision reads this one. {parameter.reader_reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
