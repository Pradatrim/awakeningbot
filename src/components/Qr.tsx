/* Renders a pre-bound invite as a scannable QR code. */
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function Qr({ value, size = 220 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#2B2118', light: '#FFFFFF' },
    }).catch(() => {
      /* ignore render errors in the prototype */
    });
  }, [value, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ borderRadius: 16, background: '#fff' }}
      aria-label="Invite QR code"
    />
  );
}
