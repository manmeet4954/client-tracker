'use client';

// The documentation library, with a real reader — 2026-08-11.
//
// HER BRIEF: "I want to include one feature that includes the documentation
// that you can include. Documentation is something that, when a client shares a
// PDF or when clients share a document or a brief about the brand, is saved
// here. Whenever I want to refer to it, I can open it. If possible, can those
// PDFs open right inside this page, in the left bar, the sidebar, properly,
// like how PDFs are built."
//
// So: the list down the left, the thing itself open on the right. A PDF renders
// as a PDF, an image as an image, a paste as its own words, a link as a link
// out. Nothing downloads to be looked at.
//
// WHY NO PDF LIBRARY. Every browser already renders PDFs, and a stored PDF is
// a URL on the same storage the app already serves. An <iframe> is the whole
// implementation. Shipping pdf.js to redraw what the browser draws would add
// about half a megabyte to make it slightly worse on a phone.
//
// The store is unchanged: `readDocuments` over the same intake documents that
// were already being filed. This is a reading surface, not a second shelf.

import { useState } from 'react';
import { FileText, Image as ImageIcon, Link as LinkIcon, Type, X } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { readDocuments } from '@/lib/intake/documents';
import type { IntakeDocument } from '@/lib/tree/objects';
import { libraryDocuments, readerKind, whoAndWhen, type ReaderKind } from '@/lib/intake/library';

export default function Library({ clientId }: { clientId: string }) {
  const { role } = useApp();
  const { data } = useClient(clientId);
  const [openId, setOpenId] = useState<string | null>(null);

  const body = data.body;
  if (!body || role !== 'owner') return null;

  // Every document on the profile, not one round's. The round a brief happened
  // to arrive under is an accident of when it came, never a filing decision.
  const docs = libraryDocuments(round => readDocuments(body, round));
  if (docs.length === 0) return null;

  const open = docs.find(d => d.id === openId) ?? null;

  return (
    <section className="mt-3 overflow-hidden rounded-card border border-hairline bg-white shadow-card">
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-[14.5px] font-semibold text-text">Documents</p>
        <p className="mt-0.5 text-[12.5px] text-faint">
          Everything they have sent you. Tap one to read it here.
        </p>
      </div>

      <div className="flex flex-col md:h-[540px] md:flex-row">
        {/* The list. On a phone it is the whole thing until one is opened. */}
        <aside
          className={`shrink-0 overflow-y-auto md:w-[248px] ${open ? 'hidden md:block' : ''}`}
          style={{ borderRight: '1px solid rgba(23,21,26,.09)' }}
        >
          {docs.map(d => (
            <button key={d.id} type="button" onClick={() => setOpenId(d.id)}
              className={`flex w-full items-start gap-2.5 px-4 py-3 text-left ${
                d.id === openId ? 'bg-chip' : 'hover:bg-chip/60'
              }`}>
              <Glyph kind={readerKind(d)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-text">{d.title}</span>
                <span className="mt-px block truncate text-[11.5px] text-faint">{whoAndWhen(d)}</span>
              </span>
            </button>
          ))}
        </aside>

        <div className={`min-w-0 flex-1 ${open ? '' : 'hidden md:block'}`}>
          {open ? <Reader doc={open} onClose={() => setOpenId(null)} /> : <Nothing />}
        </div>
      </div>
    </section>
  );
}

function Nothing() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-[13px] text-faint">Pick something on the left to read it.</p>
    </div>
  );
}

function Glyph({ kind }: { kind: ReaderKind }) {
  const props = { size: 15, strokeWidth: 2, className: 'mt-0.5 flex-none text-muted' };
  if (kind === 'pdf') return <FileText {...props} />;
  if (kind === 'image') return <ImageIcon {...props} />;
  if (kind === 'link') return <LinkIcon {...props} />;
  return <Type {...props} />;
}

function Reader({ doc, onClose }: { doc: IntakeDocument; onClose: () => void }) {
  const kind = readerKind(doc);

  return (
    <div className="flex h-full min-h-[380px] flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-text">{doc.title}</span>
          <span className="block truncate text-[11.5px] text-faint">{whoAndWhen(doc)}</span>
        </span>
        {doc.url && (
          <a href={doc.url} target="_blank" rel="noopener noreferrer"
            className="flex-none text-[12.5px] font-semibold text-accent hover:underline">
            Open it fully
          </a>
        )}
        <button type="button" aria-label="Close" onClick={onClose}
          className="flex-none text-faint hover:text-text md:hidden">
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-sunken">
        {kind === 'pdf' && doc.url && (
          // The browser's own PDF viewer: pages, scrolling, zoom, search. All of
          // it for free, and correct on a phone.
          <iframe src={doc.url} title={doc.title} className="h-full min-h-[420px] w-full border-0" />
        )}

        {kind === 'image' && doc.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.title} className="mx-auto max-w-full p-3" />
        )}

        {kind === 'text' && (
          <p className="whitespace-pre-wrap p-4 text-[13.5px] leading-[1.65] text-text">
            {doc.text || doc.extracted || 'Nothing readable was stored with this.'}
          </p>
        )}

        {kind === 'link' && (
          <div className="p-4">
            <a href={doc.url} target="_blank" rel="noopener noreferrer"
              className="break-all text-[13.5px] font-semibold text-accent hover:underline">
              {doc.url}
            </a>
            <p className="mt-2 text-[12.5px] leading-[1.5] text-faint">
              This one lives somewhere else, so it opens in a new tab rather than here.
            </p>
            {doc.extracted && (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-muted">
                {doc.extracted}
              </p>
            )}
          </div>
        )}

        {kind === 'other' && (
          <div className="p-4">
            <p className="text-[13px] leading-[1.6] text-muted">
              This is not something the browser can draw. Open it fully to see it.
            </p>
            {doc.extracted && (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-muted">
                {doc.extracted}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
