import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';

/**
 * Flow B entry — the ad landing page.
 * For elderly cold traffic a phone CTA converts far better than
 * "download an app", so the whole page drives one action: call.
 */
export default function AdLanding() {
  const nav = useNavigate();

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar onBack={() => nav('/')} />

      <div className="center-col">
        <div style={{ fontSize: 54 }}>🌅</div>
        <h1>Your health, watched over — every single day.</h1>
        <p className="lead">
          Medisun Care checks on you daily and keeps your doctor in the loop. Most members pay{' '}
          <strong style={{ color: 'var(--ink)' }}>$0</strong> — it's covered by Medicare.
        </p>
      </div>

      <div className="card stack">
        {[
          ['💛', 'A friendly check-in every morning'],
          ['🩺', 'Your doctor sees your numbers'],
          ['📦', 'Free devices shipped to your door'],
          ['💳', 'Covered by Medicare — most pay $0'],
        ].map(([emoji, text]) => (
          <div className="row" key={text}>
            <span style={{ fontSize: 30 }}>{emoji}</span>
            <span style={{ fontSize: 19, fontWeight: 600 }}>{text}</span>
          </div>
        ))}
      </div>

      <div className="grow" />

      <div className="center-col">
        <p style={{ fontSize: 19, fontWeight: 700 }}>Call now — a real person will help you join.</p>
        <button className="btn btn-primary btn-lg" onClick={() => nav('/specialist')}>
          📞 Call (855) MEDISUN
        </button>
        <p className="tiny">
          Free call. No app skills needed. Demo: this opens the enrollment specialist's screen.
        </p>
      </div>
    </div>
  );
}
