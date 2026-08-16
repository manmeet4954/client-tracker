'use client';

// Intake → Rounds → what they handed over. Spec 33 §2.
//
// The third route. A client who gives a brief and a strategy deck instead of
// typing answers has, until now, had nowhere to put them.
//
// Four things this file is careful about:
//
// 1. NO COUNT IS TYPED HERE. Every number and every line comes out of
//    lib/intake/documents.ts, counted from the array it describes.
// 2. NOTHING IS EVER SHOWN AS READ THAT WAS NOT READ. A document whose words
//    could not be got draws its state dot and says, in one plain line, why. It
//    is still listed, still openable, still reportable. It is never dropped.
// 3. NO EDIT CONTROL on a stored document, ever. It is raw material the client
//    gave (S11), the same as a raw answer. What it speaks to is decided during
//    curation, not here.
// 4. THE STANDING UI RULE (§5). Adding one is a single screen, not a sequence:
//    every field is visible at once, the kind can be changed at any point,
//    Cancel leaves with nothing lost because nothing is stored until Add, and
//    the list behind it is a list rather than a walk. Nothing here asks a
//    person to work through more than three of anything.
//
// Files use the EXISTING signed upload path, the same one Assets uses: the
// browser asks the server for permission and then sends the file straight to
// storage. There is no second upload mechanism in this app.

import { useRef, useState } from 'react';
import {
  AlertCircle, ExternalLink, FileText, Link2, Paperclip, Plus, Type, Upload, X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import type { ProfileBody } from '@/lib/tree/body';
import {
  addDocument, readDocuments, documentsLine, extractionLine, sourceWords, unread,
  extensionOf, behindLogin, DocumentRefused,
  type DocumentKind, type IntakeDocumentRecord,
} from '@/lib/intake/documents';

const BTN_DARK =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 py-2 ' +
  'text-[13px] font-semibold text-white disabled:opacity-50';
const BTN_GHOST =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] ' +
  'px-[15px] py-[7px] text-[13px] font-semibold text-text disabled:opacity-50';
const FIELD =
  'w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-sm text-text ' +
  'placeholder:text-faint focus:border-accent focus:outline-none';
const LABEL = 'mb-1 block text-[11.5px] font-bold uppercase tracking-[.09em] text-muted';

const KINDS: { id: DocumentKind; label: string; icon: typeof FileText }[] = [
  { id: 'file', label: 'File', icon: FileText },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'text', label: 'Text', icon: Type },
];

/** Ask the server for permission, then send the file STRAIGHT to storage. */
async function directUpload(file: File): Promise<string> {
  const ext = extensionOf(file.name) || 'bin';
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext, kind: 'orig' }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Could not get permission to send the file');
  }
  const { path, token, publicUrl } = await signRes.json();
  const { error } = await supabase.storage
    .from('assets')
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return publicUrl as string;
}

export interface DocumentsProps {
  clientId: string;
  body: ProfileBody;
  /** The round these belong to. */
  round: number;
  /** The questions in this round, so one can be handed over in answer to one. */
  questions?: { parameterId: string; text: string }[];
  /** Who is filing it. On her screen she says whether it was them or her. */
  defaultGivenBy?: 'client' | 'owner';
  writer?: 'owner' | 'client';
}

export default function Documents({
  clientId, body, round, questions = [], defaultGivenBy = 'client', writer = 'owner',
}: DocumentsProps) {
  const { dispatch } = useApp();
  const [adding, setAdding] = useState(false);

  const docs = readDocuments(body, round);

  function store(next: ProfileBody) {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
  }

  return (
    <section className="border-t border-divider px-[18px] py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
          Files received
        </h3>
        <p className="m-0 min-w-[12rem] flex-1 text-[12.5px] leading-[1.5] text-faint">
          {documentsLine(docs)}
        </p>
      </div>

      {docs.length > 0 && (
        <ul className="mt-2.5 flex list-none flex-col gap-2 p-0">
          {docs.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              question={questions.find(q => q.parameterId === doc.answers_parameter)?.text}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <AddForm
          body={body}
          round={round}
          questions={questions}
          defaultGivenBy={defaultGivenBy}
          writer={writer}
          onDone={next => { store(next); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${BTN_GHOST} mt-2.5`}>
          <Plus size={15} strokeWidth={2.2} />
          Add file
        </button>
      )}
    </section>
  );
}

// ── One stored document. Listed, never edited ────────────────────────────────

const KIND_ICON: Record<DocumentKind, typeof FileText> = {
  file: FileText, link: Link2, text: Type,
};

function DocumentRow({ doc, question }: { doc: IntakeDocumentRecord; question?: string }) {
  const Icon = KIND_ICON[doc.kind];
  const notRead = unread(doc);

  return (
    <li className="rounded-[14px] bg-control px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        {/* The state dot: drawn only when the words are not in hand. */}
        {notRead && (
          <span
            className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: doc.extraction_state === 'unreadable' ? '#ea4711' : '#9b95a1' }}
            aria-hidden
          />
        )}
        <Icon size={15} strokeWidth={2} className="mt-[3px] shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="m-0 break-words text-sm font-semibold leading-[1.45] text-text">{doc.title}</p>
          <p className="mt-1 text-[11.5px] text-faint">{sourceWords(doc)}</p>
          {question && (
            <p className="mt-1 text-[11.5px] leading-[1.45] text-faint">
              In answer to: {question}
            </p>
          )}
        </div>
        {doc.url && (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="mt-[2px] inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-muted"
          >
            Open
            <ExternalLink size={13} strokeWidth={2} />
          </a>
        )}
      </div>

      {doc.kind === 'text' && doc.text && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.6] text-muted">{doc.text}</p>
      )}

      <p
        className={[
          'mt-2 flex items-start gap-1.5 text-[11.5px] leading-[1.5]',
          notRead ? 'text-accent-text' : 'text-faint',
        ].join(' ')}
      >
        {notRead && <AlertCircle size={13} strokeWidth={2} className="mt-[1px] shrink-0" />}
        {extractionLine(doc)}
      </p>
    </li>
  );
}

// ── Adding one. One screen, and Cancel loses nothing ─────────────────────────

function AddForm({ body, round, questions, defaultGivenBy, writer, onDone, onCancel }: {
  body: ProfileBody;
  round: number;
  questions: { parameterId: string; text: string }[];
  defaultGivenBy: 'client' | 'owner';
  writer: 'owner' | 'client';
  onDone: (next: ProfileBody) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parameter, setParameter] = useState('');
  const [givenBy, setGivenBy] = useState<'client' | 'owner'>(defaultGivenBy);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  const ready = kind === 'file' ? !!file : kind === 'link' ? !!url.trim() : !!text.trim();

  async function add() {
    setProblem('');
    setBusy(true);
    try {
      let storedUrl = url.trim();
      if (kind === 'file') {
        if (!file) throw new Error('Pick a file first');
        storedUrl = await directUpload(file);
      }
      const { body: next } = addDocument(body, {
        round,
        kind,
        title: title.trim(),
        url: kind === 'text' ? undefined : storedUrl,
        text: kind === 'text' ? text : undefined,
        mime: file?.type,
        filename: file?.name,
        needsLogin: kind === 'link' ? needsLogin : undefined,
        given_by: givenBy,
        answers_parameter: parameter || undefined,
        now: new Date().toISOString(),
        writer,
      });
      onDone(next);
    } catch (e) {
      const message = e instanceof DocumentRefused || e instanceof Error
        ? e.message
        : 'That did not go through.';
      setProblem(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5 rounded-[14px] border border-hairline bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(k => {
          const Icon = k.icon;
          const on = kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => { setKind(k.id); setProblem(''); }}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-[7px] text-[12.5px] font-semibold',
                on ? 'bg-ink text-white' : 'bg-control text-muted',
              ].join(' ')}
            >
              <Icon size={14} strokeWidth={2} />
              {k.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-muted"
        >
          <X size={14} strokeWidth={2.2} />
          Cancel
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {kind === 'file' && (
          <div>
            <span className={LABEL}>File</span>
            <input
              ref={picker}
              type="file"
              className="hidden"
              onChange={e => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !title.trim()) setTitle(picked.name);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => picker.current?.click()}>
                <Upload size={15} strokeWidth={2.2} />
                {file ? 'Replace file' : 'Choose file'}
              </button>
              {file && (
                <span className="min-w-0 flex-1 break-words text-[12.5px] text-muted">{file.name}</span>
              )}
            </div>
          </div>
        )}

        {kind === 'link' && (
          <div>
            <span className={LABEL}>The link</span>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste it here"
              className={FIELD}
            />
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
              <input
                type="checkbox"
                checked={needsLogin || behindLogin(url)}
                disabled={behindLogin(url)}
                onChange={e => setNeedsLogin(e.target.checked)}
                className="h-[15px] w-[15px] accent-[#ea4711]"
              />
              It needs a login to open
            </label>
          </div>
        )}

        {kind === 'text' && (
          <div>
            <span className={LABEL}>Their words</span>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder="Paste what they sent, exactly as they wrote it"
              className={`${FIELD} resize-y leading-[1.6]`}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[12rem] flex-1">
            <span className={LABEL}>Name</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="The brand deck"
              className={FIELD}
            />
          </div>

          <div className="min-w-[12rem] flex-1">
            <span className={LABEL}>Attach to</span>
            <select
              value={parameter}
              onChange={e => setParameter(e.target.value)}
              className={FIELD}
            >
              <option value="">General</option>
              {questions.map(q => (
                <option key={q.parameterId} value={q.parameterId}>{q.text}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-muted">Source</span>
          {([['client', 'Client'], ['owner', 'Internal']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGivenBy(id)}
              className={[
                'whitespace-nowrap rounded-[10px] px-3 py-[6px] text-[12.5px] font-semibold',
                givenBy === id ? 'bg-ink text-white' : 'bg-control text-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {problem && (
          <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-accent-text">
            <AlertCircle size={14} strokeWidth={2} className="mt-[1px] shrink-0" />
            {problem}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={add} disabled={!ready || busy} className={BTN_DARK}>
            <Paperclip size={15} strokeWidth={2.2} />
            {busy ? 'Saving' : 'Save'}
          </button>
          <span className="min-w-[12rem] flex-1 text-[11.5px] leading-[1.5] text-faint">
            Saved as received. Stored files are never altered.
          </span>
        </div>
      </div>
    </div>
  );
}
