import { useNavigate } from 'react-router-dom';
import { resetAll, seedDemoElder } from '../store/store';

/**
 * Demo hub. In production the patient never sees this — they land
 * straight on a pre-bound invite or the ad page. For the
 * prototype it's the map: every flow is one tap away.
 */
export default function Landing() {
  const nav = useNavigate();

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

      <button
        className="btn btn-primary btn-lg"
        onClick={() => {
          seedDemoElder();
          nav('/home');
        }}
      >
        🌅 Open the daily app
      </button>
      <p className="tiny" style={{ marginTop: -8 }}>
        Signs you in as a sample enrolled patient (Eleanor, 6-day streak).
      </p>

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

      <button
        className="btn btn-ghost"
        onClick={() => {
          if (confirm('Clear all demo data on this device?')) resetAll();
        }}
      >
        Reset demo data
      </button>
    </div>
  );
}
