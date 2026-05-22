import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sun from '../components/Sun';
import { Loading } from '../components/ui';
import VoiceBar from '../components/VoiceBar';
import { hasSession, refreshMe, signOut, todayISO, useCurrentPatient } from '../store/store';
import { useNarration } from '../voice';
import type { PatientState } from '../store/types';

/**
 * The daily app — the reason to open Medisun every morning. The
 * sunrise rises as the check-in is completed and the streak grows.
 */
export default function Home() {
  const nav = useNavigate();
  const patient = useCurrentPatient();
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (patient) return;
    if (!hasSession()) {
      nav('/');
      return;
    }
    refreshMe().then((p) => {
      if (!p) nav('/');
    });
  }, [patient, nav]);

  const log = patient?.logs.find((l) => l.date === todayISO());
  const done = [log?.mood !== undefined, log?.tookMeds !== undefined, log?.bp !== undefined];
  const doneCount = done.filter(Boolean).length;
  const progress = doneCount / 3;
  const complete = doneCount === 3;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useNarration(
    patient
      ? `${greeting}, ${patient.firstName}. ${
          complete
            ? "Today's sunrise is complete. Wonderful work."
            : 'Your sunrise is waiting. Tap the big orange button to start your check-in.'
        }`
      : undefined,
  );

  if (!patient) return <Loading label="Opening your app…" />;

  return (
    <div className="screen screen-scroll fade-in">
      <div className="row-between">
        <div>
          <p className="muted" style={{ fontSize: 17 }}>
            {greeting},
          </p>
          <h1>{patient.firstName}</h1>
        </div>
        <button
          className="back"
          aria-label="Sign out"
          onClick={() => {
            signOut();
            nav('/');
          }}
        >
          ⏻
        </button>
      </div>

      <StateBanner state={patient.state} eligCost={patient.eligibility?.monthlyCost} />

      <div className="card" style={{ padding: 14, overflow: 'hidden' }}>
        <Sun progress={complete ? 1 : 0.18 + progress * 0.62} />
        <p
          style={{
            textAlign: 'center',
            fontSize: 19,
            fontWeight: 700,
            marginTop: 8,
            color: 'var(--sun-deep)',
          }}
        >
          {complete
            ? `🌅 Today's sunrise is complete, ${patient.firstName}!`
            : doneCount === 0
              ? 'Your sunrise is waiting for you.'
              : `Almost there — ${3 - doneCount} step${3 - doneCount === 1 ? '' : 's'} to go.`}
        </p>
      </div>

      <div className="card row-between">
        <div className="row">
          <span style={{ fontSize: 40 }}>🔥</span>
          <div>
            <div className="big-number" style={{ fontSize: 38 }}>
              {patient.streak}
            </div>
            <p className="muted" style={{ fontSize: 16 }}>
              {patient.streak === 1 ? 'sunrise' : 'sunrises'} in a row
            </p>
          </div>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 'auto' }}
          onClick={() => setShare(!share)}
        >
          Share 🎉
        </button>
      </div>

      {share && (
        <div className="card-flat fade-in stack">
          <p style={{ fontSize: 19, fontWeight: 700 }}>
            "{patient.firstName} has a {patient.streak}-day health streak on Medisun! 🌅"
          </p>
          <p className="tiny">
            Share with family so they know you're doing great — and dare a friend to start.
          </p>
          <button className="btn btn-secondary" onClick={() => setShare(false)}>
            Send to family
          </button>
        </div>
      )}

      {complete ? (
        <div className="card-flat center-col">
          <span style={{ fontSize: 34 }}>✅</span>
          <p style={{ fontSize: 19, fontWeight: 700 }}>You've checked in today.</p>
          <p className="tiny">Come back tomorrow to keep your streak alive.</p>
        </div>
      ) : (
        <button className="btn btn-primary btn-lg" onClick={() => nav('/checkin')}>
          {doneCount === 0 ? "☀️ Start today's check-in" : '☀️ Finish my check-in'}
        </button>
      )}

      <div className="row" style={{ gap: 12 }}>
        <TileButton emoji="❤️" label="My vitals" onClick={() => nav('/vitals')} />
        <TileButton
          emoji="📞"
          label="My care team"
          onClick={() =>
            alert(
              `Your care team reviews your numbers every day.\n\nIf anything needs attention they call ${patient.phone}. You can request a call any time.`,
            )
          }
        />
      </div>

      <VoiceBar />

      <p className="tiny" style={{ textAlign: 'center' }}>
        Medisun Care • You're never alone in this.
      </p>
    </div>
  );
}

function StateBanner({ state, eligCost }: { state: PatientState; eligCost?: number }) {
  const map: Record<PatientState, { cls: string; text: string }> = {
    covered: {
      cls: 'pill-leaf',
      text: `✓ Covered by Medicare${eligCost === 0 ? ' • $0/month' : ''}`,
    },
    'pending-order': {
      cls: 'pill-sun',
      text: "🌤️ Doctor's order is being finalized — nothing billed yet",
    },
    'not-covered': { cls: 'pill-sun', text: '💛 Free health tier' },
    free: { cls: 'pill-sun', text: '💛 Free health tier' },
  };
  const m = map[state];
  return (
    <div
      className={`pill ${m.cls}`}
      style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 16 }}
    >
      {m.text}
    </div>
  );
}

function TileButton({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="card"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        minHeight: 104,
      }}
      onClick={onClick}
    >
      <span style={{ fontSize: 34 }}>{emoji}</span>
      <span style={{ fontSize: 18, fontWeight: 700 }}>{label}</span>
    </button>
  );
}
