'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-xl border border-stone-200 w-full flex flex-col max-h-[90vh]',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* The body PADS ITSELF (2026-08-11).
            It used to have none, so every caller had to remember `p-6` and the
            fourth one did not: the Add-a-post fields ran wider than the dialog's
            own title and touched both edges. Her note, for the second time that
            day: "the same edge problem."
            A frame that only looks right when every caller compensates is a
            trap, so the frame does it. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
