import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
        width: 180,
        height: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 18px',
        gap: 0,
      }}
    >
      <div style={{ color: '#fff', fontSize: 68, fontWeight: 800, lineHeight: 1, letterSpacing: -2, display: 'flex' }}>
        My
      </div>
      <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5, display: 'flex' }}>
        Clients.
      </div>
    </div>,
    { width: 180, height: 180 }
  );
}
