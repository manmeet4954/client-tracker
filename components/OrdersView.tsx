'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Package } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { SoniaOrder, OrderPaymentStatus, OrderDeliveryStatus } from '@/types';

const PAYMENT_OPTS: { value: OrderPaymentStatus; label: string; color: string; bg: string }[] = [
  { value: 'received',     label: 'Received',     color: '#059669', bg: '#d1fae5' },
  { value: 'not-received', label: 'Not Received', color: '#dc2626', bg: '#fee2e2' },
  { value: 'partial',      label: 'Partial',      color: '#d97706', bg: '#fef3c7' },
];

const DELIVERY_OPTS: { value: OrderDeliveryStatus; label: string; color: string; bg: string }[] = [
  { value: 'delivered',      label: 'Delivered',       color: '#059669', bg: '#d1fae5' },
  { value: 'yet-to-deliver', label: 'Yet to Deliver',  color: '#0284c7', bg: '#e0f2fe' },
  { value: 'in-process',    label: 'In Process',      color: '#7c3aed', bg: '#ede9fe' },
];

function paymentStyle(s: OrderPaymentStatus) {
  return PAYMENT_OPTS.find(o => o.value === s) ?? PAYMENT_OPTS[1];
}
function deliveryStyle(s: OrderDeliveryStatus) {
  return DELIVERY_OPTS.find(o => o.value === s) ?? DELIVERY_OPTS[1];
}

const emptyForm = (): Omit<SoniaOrder, 'id' | 'createdAt'> => ({
  name: '',
  items: '',
  amount: 0,
  orderType: '',
  paymentStatus: 'not-received',
  deliveryStatus: 'yet-to-deliver',
});

export default function OrdersView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const orders = data.orders ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SoniaOrder | null>(null);

  function submitAdd() {
    if (!form.name.trim()) return;
    dispatch({
      type: 'ADD_ORDER',
      payload: {
        clientId,
        order: { ...form, id: generateId(), createdAt: new Date().toISOString() },
      },
    });
    setForm(emptyForm());
    setShowAdd(false);
  }

  function startEdit(order: SoniaOrder) {
    setEditingId(order.id);
    setEditForm({ ...order });
  }

  function saveEdit() {
    if (!editForm) return;
    dispatch({ type: 'UPDATE_ORDER', payload: { clientId, order: editForm } });
    setEditingId(null);
    setEditForm(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-stone-900">Orders</h2>
          <p className="text-sm text-stone-400 mt-0.5">{orders.length} total</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-[#1f1f1f] text-white rounded-lg hover:bg-stone-700 transition-colors"
        >
          <Plus size={15} /> Add Order
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <OrderForm
          form={form}
          onChange={setForm}
          onSubmit={submitAdd}
          onCancel={() => { setShowAdd(false); setForm(emptyForm()); }}
          submitLabel="Add Order"
        />
      )}

      {/* Empty state */}
      {orders.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <Package size={24} className="text-rose-400" />
          </div>
          <p className="font-semibold text-stone-700 mb-1">No orders yet</p>
          <p className="text-sm text-stone-400">Add your first order above</p>
        </div>
      )}

      {/* Order cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.map(order => (
          editingId === order.id && editForm ? (
            <div key={order.id} className="bg-white rounded-2xl border border-stone-200 p-4">
              <OrderForm
                form={editForm}
                onChange={setEditForm as (f: Omit<SoniaOrder, 'id' | 'createdAt'>) => void}
                onSubmit={saveEdit}
                onCancel={cancelEdit}
                submitLabel="Save"
                compact
              />
            </div>
          ) : (
            <OrderCard
              key={order.id}
              order={order}
              onEdit={() => startEdit(order)}
              onDelete={() => dispatch({ type: 'DELETE_ORDER', payload: { clientId, orderId: order.id } })}
            />
          )
        ))}
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onEdit, onDelete }: {
  order: SoniaOrder;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pay = paymentStyle(order.paymentStatus);
  const del = deliveryStyle(order.deliveryStatus);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-stone-900 text-sm leading-snug">{order.name}</p>
          {order.items && <p className="text-xs text-stone-500 mt-0.5">{order.items}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Amount + type */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-stone-900">₹{order.amount.toLocaleString('en-IN')}</span>
        {order.orderType && (
          <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{order.orderType}</span>
        )}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ color: pay.color, backgroundColor: pay.bg }}
        >
          {pay.label}
        </span>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ color: del.color, backgroundColor: del.bg }}
        >
          {del.label}
        </span>
      </div>
    </div>
  );
}

// ── Shared form ───────────────────────────────────────────────────────────────

type FormData = Omit<SoniaOrder, 'id' | 'createdAt'>;

function OrderForm({ form, onChange, onSubmit, onCancel, submitLabel, compact = false }: {
  form: FormData;
  onChange: (f: FormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  compact?: boolean;
}) {
  const set = (patch: Partial<FormData>) => onChange({ ...form, ...patch });
  const inputCls = 'w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 bg-white placeholder-stone-400 text-stone-700';
  const labelCls = 'block text-xs font-medium text-stone-500 mb-1';

  return (
    <div className={`bg-stone-50 rounded-2xl border border-stone-200 ${compact ? 'space-y-3' : 'p-5 space-y-4'}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Customer Name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="e.g. Priya Sharma"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Items Ordered</label>
          <input
            value={form.items}
            onChange={e => set({ items: e.target.value })}
            placeholder="e.g. Crochet bag, top"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Amount (₹)</label>
          <input
            type="number"
            min={0}
            value={form.amount || ''}
            onChange={e => set({ amount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Type / Note</label>
          <input
            value={form.orderType}
            onChange={e => set({ orderType: e.target.value })}
            placeholder="e.g. Advance, Full Payment"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Payment Status</label>
          <select
            value={form.paymentStatus}
            onChange={e => set({ paymentStatus: e.target.value as OrderPaymentStatus })}
            className={inputCls}
          >
            {PAYMENT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Delivery Status</label>
          <select
            value={form.deliveryStatus}
            onChange={e => set({ deliveryStatus: e.target.value as OrderDeliveryStatus })}
            className={inputCls}
          >
            {DELIVERY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-white transition-colors"
        >
          <X size={14} /> Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1f1f1f] text-white rounded-lg hover:bg-stone-700 disabled:opacity-30 transition-colors"
        >
          <Check size={14} /> {submitLabel}
        </button>
      </div>
    </div>
  );
}
