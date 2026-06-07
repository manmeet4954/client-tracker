import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#1c1917',
        width: 180,
        height: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {/* Three dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#8B5CF6' }} />
        <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#10B981' }} />
        <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#F43F5E' }} />
      </div>

      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ color: '#f7f7f5', fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
          My Clients
        </span>
        <span style={{ color: '#ea4711', fontSize: 28, fontWeight: 700, lineHeight: 0 }}>.</span>
      </div>
    </div>,
    { width: 180, height: 180 }
  );
}
