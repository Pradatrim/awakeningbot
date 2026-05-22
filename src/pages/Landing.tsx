import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoLogin } from '../store/store';

/**
 * Demo hub. In production the patient never sees this — they land
 * on a pre-bound invite or the ad page. For the prototype it maps
 * every flow, including the clinician dashboard.
 */
export default function Landing() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function openDailyApp() {
    setBusy(true);
    setError('');
    try {
      await demoLogin();
      nav('/home');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-scroll fade-in">
      <div className="center-col" style={{ marginTop: 8 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            background: 'linear-gradient(180deg,#FFF7EC,#FFE6C4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            boxShadow: 'var(--shadow)',
          }}
        >
          🌅
        </div>
        <h1>Medisun Care</h1>
        <p className="lead">
          The daily telehealth app built for adults 65+. Covered by Medicare. Easy from the very
          first tap.
        </p>
      </div>

      <div className="divider" />
      <p className="tiny" style={{ textAlign: 'center' }}>
        PROTOTYPE — choose a path to explore
      </p>

      <button className="btn btn-primary btn-lg" disabled={busy} onClick={openDailyApp}>
        {busy ? 'Opening…' : '🌅 Open the daily app'}
      </button>
      <p className="tiny" style={{ marginTop: -8 }}>
        Signs you in as a sample enrolled patient (Eleanor, 6-day streak).
      </p>
      {error && (
        <p className="tiny" style={{ color: 'var(--alert)', textAlign: 'center' }}>
          {error} — is the API server running?
        </p>
      )}

      <div className="card stack">
        <h3>Enrollment — Flow A</h3>
        <p className="muted" style={{ fontSize: 18 }}>
          Doctor referral. The doctor places the order in the room and the patient self-enrolls by
          scanning a QR code.
        </p>
        <button className="btn btn-secondary" onClick={() => nav('/provider')}>
          🩺 Open the doctor's screen
        </button>
      </div>

      <div className="card stack">
        <h3>Enrollment — Flow B</h3>
        <p className="muted" style={{ fontSize: 18 }}>
          Ad → phone call. A cold patient sees an ad, calls in, and an enrollment specialist does
          the work.
        </p>
        <button className="btn btn-secondary" onClick={() => nav('/care')}>
          📺 See the ad landing page
        </button>
        <button className="btn btn-ghost" onClick={() => nav('/specialist')}>
          Jump to the specialist console →
        </button>
      </div>

      <div className="card stack">
        <h3>Care team</h3>
        <p className="muted" style={{ fontSize: 18 }}>
          The clinician dashboard — every monitored patient, their daily readings, and alerts that
          need attention.
        </p>
        <button className="btn btn-secondary" onClick={() => nav('/clinician/login')}>
          👩‍⚕️ Open the clinician dashboard
        </button>
      </div>
    </div>
  );
}
