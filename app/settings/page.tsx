'use client';

// `/settings` — access, outside the app, on her instruction (2026-08-11).

import Access from '@/components/settings/Access';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Access />
    </div>
  );
}
