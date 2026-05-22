/* ============================================================
   Sun — the daily engagement visual.

   The reason to open Medisun every morning. The sun rises as the
   elder completes their check-in. At 0 it sits below the horizon
   in pre-dawn; at 1 it is high and bright with rays and birds.
   ============================================================ */

interface SunProps {
  /** 0 → pre-dawn, 1 → full sunrise. */
  progress: number;
  /** Optional height in px. */
  height?: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(c1: string, c2: string, t: number) {
  const p = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Sun({ progress, height = 200 }: SunProps) {
  const t = Math.min(1, Math.max(0, progress));

  const horizonY = 160;
  const sunR = 40;
  // Sun travels from just below the horizon up to a high morning point.
  const sunCY = lerp(horizonY + sunR + 6, 58, t);

  const skyTop = mix('#3D3B6B', '#FFE9B0', t); // dusk indigo → warm morning
  const skyBot = mix('#C97B6B', '#FFC98E', t); // muted dawn → glowing peach
  const rayOpacity = Math.max(0, (t - 0.35) / 0.65);
  const birdsOpacity = t >= 0.999 ? 1 : 0;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      height={height}
      role="img"
      aria-label={`Your sunrise, ${Math.round(t * 100)} percent`}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBot} />
        </linearGradient>
        <radialGradient id="sunGrad" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFF4D6" />
          <stop offset="62%" stopColor="#FFB347" />
          <stop offset="100%" stopColor="#F57C2B" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE3A8" stopOpacity={lerp(0.1, 0.85, t)} />
          <stop offset="100%" stopColor="#FFE3A8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="skyClip">
          <rect x="0" y="0" width="320" height="200" rx="20" />
        </clipPath>
      </defs>

      <g clipPath="url(#skyClip)">
        <rect x="0" y="0" width="320" height="200" fill="url(#sky)" />

        {/* glow halo behind the sun */}
        <circle cx="160" cy={sunCY} r="120" fill="url(#glow)" />

        {/* rays */}
        <g
          opacity={rayOpacity}
          stroke="#FFD37A"
          strokeWidth="6"
          strokeLinecap="round"
          style={{ transition: 'opacity 0.6s ease' }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2;
            const inner = sunR + 12;
            const outer = sunR + 30;
            return (
              <line
                key={i}
                x1={160 + Math.cos(ang) * inner}
                y1={sunCY + Math.sin(ang) * inner}
                x2={160 + Math.cos(ang) * outer}
                y2={sunCY + Math.sin(ang) * outer}
              />
            );
          })}
        </g>

        {/* the sun */}
        <circle
          cx="160"
          cy={sunCY}
          r={sunR}
          fill="url(#sunGrad)"
          style={{ transition: 'cy 0.9s cubic-bezier(.2,.8,.2,1)' }}
        />

        {/* birds at full sunrise */}
        <g
          opacity={birdsOpacity}
          stroke="#7A5A3A"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{ transition: 'opacity 0.6s ease' }}
        >
          <path d="M70 56 q7 -8 14 0 q7 -8 14 0" />
          <path d="M210 44 q6 -7 12 0 q6 -7 12 0" />
        </g>

        {/* horizon hills */}
        <path
          d={`M0 ${horizonY} Q 80 ${horizonY - 28} 160 ${horizonY} T 320 ${horizonY} V200 H0 Z`}
          fill={mix('#2E5D4B', '#3F8F63', t)}
        />
        <path
          d={`M0 ${horizonY + 22} Q 110 ${horizonY - 4} 220 ${horizonY + 22} T 320 ${horizonY + 30} V200 H0 Z`}
          fill={mix('#244C3D', '#2F8F5B', t)}
        />
      </g>
    </svg>
  );
}
