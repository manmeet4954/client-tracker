'use client';

// Platforms. A pick from a list, and each picked platform opens its formats to
// tick. Nothing is typed here at all (spec 34 §3).

import { Check } from 'lucide-react';
import { PLATFORM_LIBRARY, formatsFor, type PlatformPick } from '@/lib/strategy/inputs';
import { Kicker, Pick } from './ui';

export default function Platforms({
  value, onChange,
}: { value: PlatformPick[]; onChange: (next: PlatformPick[]) => void }) {
  const picked = (name: string) => value.find(p => p.platform.toLowerCase() === name.toLowerCase());

  // Anything already stored that the library does not know about still shows,
  // because a decision she made earlier is never quietly dropped.
  const extra = value.filter(p => !PLATFORM_LIBRARY.some(l => l.platform.toLowerCase() === p.platform.toLowerCase()));
  const all = [...PLATFORM_LIBRARY.map(l => l.platform), ...extra.map(e => e.platform)];

  function toggle(name: string) {
    const hit = picked(name);
    if (hit) onChange(value.filter(p => p !== hit));
    else onChange([...value, { platform: name, formats: [] }]);
  }

  function toggleFormat(name: string, format: string) {
    onChange(value.map(p => {
      if (p.platform.toLowerCase() !== name.toLowerCase()) return p;
      const on = p.formats.includes(format);
      return { ...p, formats: on ? p.formats.filter(f => f !== format) : [...p.formats, format] };
    }));
  }

  return (
    <div>
      <Kicker>Where this brand posts</Kicker>
      <div className="flex flex-wrap gap-1.5">
        {all.map(name => (
          <Pick key={name} on={!!picked(name)} onClick={() => toggle(name)}>{name}</Pick>
        ))}
      </div>

      {value.length > 0 && (
        <div className="mt-3.5 space-y-2.5">
          {value.map(p => {
            const formats = formatsFor(p.platform);
            return (
              <div key={p.platform} className="rounded-card border border-hairline bg-white p-3.5">
                <p className="mb-2 text-[13.5px] font-semibold text-text">{p.platform}</p>
                {formats.length === 0 ? (
                  <p className="text-[12.5px] text-faint">No format list for this one yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {formats.map(f => {
                      const on = p.formats.includes(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggleFormat(p.platform, f)}
                          className={`flex items-center gap-1.5 rounded-[10px] px-[11px] py-[6px] text-[12.5px] font-semibold ${
                            on ? 'bg-ink text-white' : 'border border-hairline bg-white text-muted hover:text-text'
                          }`}
                        >
                          {on && <Check size={13} strokeWidth={2.6} />}
                          {f}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
