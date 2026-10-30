import { ImageResponse } from 'next/og';

/**
 * The app icon: an amber price pin on the dark background. `padding` leaves
 * room for Android's maskable crop.
 */
export function appIcon(size: number, { padding = 0.18 }: { padding?: number } = {}) {
  const pin = Math.round(size * (1 - padding * 2));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E1013',
        }}
      >
        <div
          style={{
            width: pin,
            height: pin * 0.62,
            borderRadius: pin * 0.31,
            background: '#F5A524',
            color: '#0E1013',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: pin * 0.42,
            fontWeight: 800,
            letterSpacing: -pin * 0.02,
          }}
        >
          $$
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
