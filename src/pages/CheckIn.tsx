import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sun from '../components/Sun';
import { Choice, Dots } from '../components/ui';
import { recordCheckIn, useStore } from '../store/store';

type Step = 'mood' | 'meds' | 'vitals' | 'done';
const ORDER: Step[] = ['mood', 'meds', 'vitals'];

/**
 * The daily ritual — three quick, friendly steps. The sun rises
 * with each one. Finishing it completes the day and grows the
 * streak.
 */
export default function CheckIn() {
  const nav = useNavigate();
  const patient = useStore((s) =>
    s.currentPatientId ? s.patients[s.currentPatientId] : undefined,
  );

  const [step, setStep] = useState<Step>('mood');
  const [measuring, setMeasuring] = useState(false);
  const [reading, setReading] = useState<{ sys: number; dia: number; hr: number } | null>(null);

  useEffect(() => {
    if (!patient) nav('/');
  }, [patient, nav]);
  if (!patient) return null;

  const idx = ORDER.indexOf(step);
  const progress = step === 'done' ? 1 : 0.2 + (idx / 3) * 0.6;

  function takeReading() {
    setMeasuring(true);
    setTimeout(() => {
      const r = {
        sys: 118 + Math.floor(Math.random() * 21),
        dia: 72 + Math.floor(Math.random() * 15),
        hr: 62 + Math.floor(Math.random() * 17),
      };
      setReading(r);
      setMeasuring(false);
      recordCheckIn(patient!.id, { bp: { sys: r.sys, dia: r.dia }, heartRate: r.hr });
    }, 2600);
  }

  /* ---------- celebration ---------- */
  if (step === 'done') {
    return (
      <div className="screen fade-in">
        <div className="grow" />
        <Sun progress={1} height={190} />
        <div className="center-col">
          <div className="pop" style={{ fontSize: 54 }}>🎉</div>
          <h1>You did it, {patient.firstName}!</h1>
          <p className="lead">Today's sunrise is complete. Your care team has your numbers.</p>
          <div className="card row" style={{ gap: 12 }}>
            <span style={{ fontSize: 38 }}>🔥</span>
            <div style={{ textAlign: 'left' }}>
              <div className="big-number" style={{ fontSize: 36 }}>
                {patient.streak}
              </div>
              <p className="muted" style={{ fontSize: 16 }}>
                {patient.streak === 1 ? 'day' : 'days'} in a row — keep it going!
              </p>
            </div>
          </div>
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => nav('/home')}>
          Back to my home
        </button>
      </div>
    );
  }

  return (
    <div className="screen screen-scroll fade-in">
      <Sun progress={progress} height={130} />
      <Dots count={3} active={idx} />

      {step === 'mood' && (
        <>
          <h1>How are you feeling today?</h1>
          <div className="stack">
            <Choice
              emoji="😊"
              label="Great"
              selected={false}
              onClick={() => {
                recordCheckIn(patient.id, { mood: 'great' });
                setStep('meds');
              }}
            />
            <Choice
              emoji="🙂"
              label="Okay"
              selected={false}
              onClick={() => {
                recordCheckIn(patient.id, { mood: 'okay' });
                setStep('meds');
              }}
            />
            <Choice
              emoji="😟"
              label="A little rough"
              selected={false}
              onClick={() => {
                recordCheckIn(patient.id, { mood: 'rough' });
                setStep('meds');
              }}
            />
          </div>
        </>
      )}

      {step === 'meds' && (
        <>
          <h1>Did you take your morning medicine?</h1>
          <div className="stack">
            <Choice
              emoji="💊"
              label="Yes, all taken"
              selected={false}
              onClick={() => {
                recordCheckIn(patient.id, { tookMeds: true });
                setStep('vitals');
              }}
            />
            <Choice
              emoji="⏰"
              label="Not yet — I'll do it soon"
              selected={false}
              onClick={() => {
                recordCheckIn(patient.id, { tookMeds: false });
                setStep('vitals');
              }}
            />
          </div>
        </>
      )}

      {step === 'vitals' && (
        <>
          <h1>Let's check your blood pressure.</h1>
          {!reading && !measuring && (
            <>
              <p className="lead">
                Put on your Medisun cuff and rest your arm on the table. When you're comfortable,
                tap below.
              </p>
              <div className="grow" />
              <button className="btn btn-primary btn-lg" onClick={takeReading}>
                ❤️ Start my reading
              </button>
            </>
          )}

          {measuring && (
            <div className="center-col grow" style={{ justifyContent: 'center' }}>
              <div
                style={{ fontSize: 60, animation: 'pop 1s ease-in-out infinite alternate' }}
              >
                ❤️
              </div>
              <h2>Measuring…</h2>
              <p className="muted">Stay relaxed and still — almost done.</p>
            </div>
          )}

          {reading && (
            <>
              <div className="card center-col">
                <span className="pill pill-leaf">Reading saved</span>
                <div className="row" style={{ gap: 24 }}>
                  <div>
                    <div className="big-number">
                      {reading.sys}/{reading.dia}
                    </div>
                    <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                      blood pressure
                    </p>
                  </div>
                  <div>
                    <div className="big-number">{reading.hr}</div>
                    <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                      heart rate
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--leaf)' }}>
                  Looking good — your numbers are in a healthy range. 💚
                </p>
              </div>
              <div className="grow" />
              <button className="btn btn-primary btn-lg" onClick={() => setStep('done')}>
                Finish my check-in
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
