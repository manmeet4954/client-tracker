import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
        width: 512,
        height: 512,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 54px',
        gap: 0,
      }}
    >
      <div style={{ color: '#fff', fontSize: 196, fontWeight: 800, lineHeight: 1, letterSpacing: -6, display: 'flex' }}>
        My
      </div>
      <div style={{ color: '#fff', fontSize: 86, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2, display: 'flex' }}>
        Clients.
      </div>
    </div>,
    { width: 512, height: 512 }
  );
}
