'use client';

// Sonia's money book — spec 37, 2026-09-07.
//
// Built for Manmeet's mother. She writes a note, an amount, and taps Income or
// Expense; for income, one more tap says whether the money is in hand or still
// to come. It saves on the tap — no submit button to forget. Below sits one
// plain sentence of a balance sheet for the month.
//
// Everything here is deliberately large and plainly worded. The reader is not a
// dashboard user; she is someone who wants to see, honestly and at a glance,
// how much she made and how much she spent.

import { useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, formatMonthKey, formatMonthLabel, prevMonth, nextMonth } from '@/lib/utils';
import type { LedgerEntry } from '@/types';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function MoneyView({ clientId, accent = '#ea4711' }: {
  clientId: string;
  accent?: string;
}) {
  const { dispatch, saveNow } = useApp();
  const { data } = useClient(clientId);
  const all = data.ledger ?? [];

  const [month, setMonth] = useState(() => formatMonthKey(new Date()));
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(true);

  const entries = all
    .filter(e => e.month === month)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // The sentence. In hand is real money: income received, less what was spent.
  // Still to come is income she has not been paid yet.
  const receivedIn = sum(entries.filter(e => e.kind === 'income' && e.received));
  const stillToCome = sum(entries.filter(e => e.kind === 'income' && !e.received));
  const spent = sum(entries.filter(e => e.kind === 'expense'));
  const inHand = receivedIn - spent;

  function add(kind: 'income' | 'expense') {
    const value = parseFloat(amount);
    if (!note.trim() || !Number.isFinite(value) || value <= 0) return;
    const entry: LedgerEntry = {
      id: generateId(),
      note: note.trim(),
      amount: value,
      kind,
      // An expense is money already gone, so `received` is not used for it.
      received: kind === 'income' ? received : true,
      month,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_LEDGER_ENTRY', payload: { clientId, entry } });
    void saveNow();
    setNote('');
    setAmount('');
    setReceived(true);
  }

  function toggleReceived(e: LedgerEntry) {
    if (e.kind !== 'income') return;
    dispatch({ type: 'UPDATE_LEDGER_ENTRY', payload: { clientId, entry: { ...e, received: !e.received } } });
    void saveNow();
  }

  function remove(e: LedgerEntry) {
    if (!confirm(`Delete "${e.note}"? This cannot be undone.`)) return;
    dispatch({ type: 'DELETE_LEDGER_ENTRY', payload: { clientId, entryId: e.id } });
    void saveNow();
  }

  const isThisMonth = month === formatMonthKey(new Date());

  return (
    <div className="mx-auto max-w-xl p-4 md:p-6">
      {/* The month, with arrows. */}
      <div className="mb-4 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(prevMonth(month))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100">
          <ChevronLeft size={24} />
        </button>
        <span className="text-lg font-bold text-stone-900">{formatMonthLabel(month)}</span>
        <button type="button" aria-label="Next month" onClick={() => setMonth(nextMonth(month))}
          disabled={isThisMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 disabled:opacity-30">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* The balance sheet. One big number, then the sentence in three lines. */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-stone-500">Money in hand</p>
        <p className="mt-1 text-4xl font-bold" style={{ color: inHand < 0 ? '#dc2626' : '#0f172a' }}>
          {rupees(inHand)}
        </p>
        <div className="mt-4 space-y-2 text-[15px]">
          <Line label="Received this month" value={rupees(receivedIn)} color="#059669" />
          <Line label="Still to come" value={rupees(stillToCome)} color="#0284c7" />
          <Line label="Spent this month" value={rupees(spent)} color="#dc2626" />
        </div>
      </div>

      {/* Record: note, amount, then two big buttons. Saves on the tap. */}
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What was it? e.g. Sold 2 scarves"
          className="w-full rounded-xl border border-stone-300 px-4 py-3 text-[16px] text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
        />
        <input
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          placeholder="Amount"
          className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3 text-[22px] font-semibold text-stone-900 placeholder:text-stone-400 placeholder:font-normal placeholder:text-[16px] focus:border-stone-900 focus:outline-none"
        />

        {/* For income only: is the money in hand, or still coming? */}
        <div className="mt-3 flex gap-2">
          <Toggle on={received} onClick={() => setReceived(true)} accent={accent}>Got it</Toggle>
          <Toggle on={!received} onClick={() => setReceived(false)} accent={accent}>Still to come</Toggle>
        </div>
        <p className="mt-1.5 text-[12px] text-stone-400">The choice above is only used when you add income.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => add('income')}
            className="rounded-xl bg-emerald-600 py-4 text-[17px] font-bold text-white active:bg-emerald-700">
            + Income
          </button>
          <button type="button" onClick={() => add('expense')}
            className="rounded-xl bg-rose-600 py-4 text-[17px] font-bold text-white active:bg-rose-700">
            − Expense
          </button>
        </div>
      </div>

      {/* The list. Newest first. Tap the tag to flip received; trash to delete. */}
      <div className="mt-5 space-y-2">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-white px-4 py-8 text-center text-[15px] text-stone-400">
            Nothing written for this month yet.
          </p>
        ) : entries.map(e => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-stone-900">{e.note}</p>
              {e.kind === 'income' ? (
                <button type="button" onClick={() => toggleReceived(e)}
                  className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold"
                  style={{ color: e.received ? '#059669' : '#0284c7' }}>
                  {e.received ? <><Check size={13} /> Got it</> : 'Still to come · tap when paid'}
                </button>
              ) : (
                <p className="mt-0.5 text-[12.5px] font-semibold text-rose-600">Expense</p>
              )}
            </div>
            <span className="text-[17px] font-bold" style={{ color: e.kind === 'income' ? '#0f172a' : '#dc2626' }}>
              {e.kind === 'income' ? '' : '− '}{rupees(e.amount)}
            </span>
            <button type="button" aria-label="Delete" onClick={() => remove(e)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-rose-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function sum(list: LedgerEntry[]): number {
  return list.reduce((t, e) => t + (Number.isFinite(e.amount) ? e.amount : 0), 0);
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-600">{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onClick, accent, children }: {
  on: boolean; onClick: () => void; accent: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 rounded-xl border py-2.5 text-[14px] font-semibold"
      style={on
        ? { borderColor: accent, color: accent, background: `${accent}12` }
        : { borderColor: '#e7e5e4', color: '#78716c' }}>
      {children}
    </button>
  );
}
