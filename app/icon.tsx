import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#1c1917',
        width: 512,
        height: 512,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}
    >
      {/* Three client dots */}
      <div style={{ display: 'flex', gap: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#8B5CF6' }} />
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#10B981' }} />
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F43F5E' }} />
      </div>

      {/* App name */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
        <span style={{ color: '#f7f7f5', fontSize: 68, fontWeight: 700, letterSpacing: -2 }}>
          My Clients
        </span>
        <span style={{ color: '#ea4711', fontSize: 80, fontWeight: 700, lineHeight: 0 }}>.</span>
      </div>
    </div>,
    { width: 512, height: 512 }
  );
}
