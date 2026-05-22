import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sun from '../components/Sun';
import { Choice, Dots, Loading } from '../components/ui';
import VoiceBar from '../components/VoiceBar';
import { checkIn, hasSession, refreshMe, useCurrentPatient } from '../store/store';
import { useNarration } from '../voice';
import {
  isBluetoothSupported,
  readFromCuff,
  simulateReading,
  type BpReading,
} from '../device/bluetoothBp';
import type { Alert } from '../store/types';

type Step = 'mood' | 'meds' | 'vitals' | 'done';
const ORDER: Step[] = ['mood', 'meds', 'vitals'];

/**
 * The daily ritual — three quick steps, narrated aloud. The
 * blood-pressure step reads from a real Bluetooth cuff when one
 * is available, and falls back to a simulated reading otherwise.
 */
export default function CheckIn() {
  const nav = useNavigate();
  const patient = useCurrentPatient();

  const [step, setStep] = useState<Step>('mood');
  const [busy, setBusy] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [reading, setReading] = useState<BpReading | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);

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

  /* ---- spoken script for the current step ---- */
  let narration: string | undefined;
  if (patient) {
    if (step === 'done') {
      narration = `You did it, ${patient.firstName}! Today's sunrise is complete.${
        alerts.length ? ' Your care team has seen your numbers.' : ''
      }`;
    } else if (step === 'mood') {
      narration = 'How are you feeling today? Tap the answer that fits best.';
    } else if (step === 'meds') {
      narration = 'Did you take your morning medicine? Tap yes, or not yet.';
    } else if (reading) {
      narration = `Your blood pressure is ${reading.sys} over ${reading.dia}.${
        alerts.length
          ? " We've shared this with your care team."
          : ' That is a healthy reading.'
      } Tap finish my check-in.`;
    } else if (measuring) {
      narration = 'Measuring now. Stay relaxed and still.';
    } else {
      narration =
        "Now let's check your blood pressure. Put on your cuff, rest your arm, then tap the button below.";
    }
  }
  useNarration(narration);

  if (!patient) return <Loading label="Opening your check-in…" />;

  const idx = ORDER.indexOf(step);
  const progress = step === 'done' ? 1 : 0.2 + (idx / 3) * 0.6;

  async function pickMood(mood: 'great' | 'okay' | 'rough') {
    setBusy(true);
    await checkIn({ mood });
    setBusy(false);
    setStep('meds');
  }

  async function pickMeds(tookMeds: boolean) {
    setBusy(true);
    await checkIn({ tookMeds });
    setBusy(false);
    setStep('vitals');
  }

  async function takeReading(useCuff: boolean) {
    setDeviceError('');
    setMeasuring(true);
    try {
      const r = useCuff ? await readFromCuff() : await simulateReading();
      setReading(r);
      const res = await checkIn({
        bp: { sys: r.sys, dia: r.dia },
        heartRate: r.heartRate,
        source: r.source,
      });
      setAlerts(res.alerts);
    } catch (e) {
      setDeviceError((e as Error).message || 'Could not read from the cuff.');
    } finally {
      setMeasuring(false);
    }
  }

  /* ---------- celebration ---------- */
  if (step === 'done') {
    const flagged = alerts.length > 0;
    return (
      <div className="screen fade-in">
        <VoiceBar line={narration} />
        <div className="grow" />
        <Sun progress={1} height={190} />
        <div className="center-col">
          <div className="pop" style={{ fontSize: 54 }}>🎉</div>
          <h1>You did it, {patient.firstName}!</h1>
          <p className="lead">
            {flagged
              ? 'Today is complete. Your care team saw your numbers and will check in with you.'
              : "Today's sunrise is complete. Your care team has your numbers."}
          </p>
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
      <VoiceBar line={narration} />
      <Sun progress={progress} height={130} />
      <Dots count={3} active={idx} />

      {step === 'mood' && (
        <>
          <h1>How are you feeling today?</h1>
          <div className="stack">
            <Choice emoji="😊" label="Great" selected={false} onClick={() => !busy && pickMood('great')} />
            <Choice emoji="🙂" label="Okay" selected={false} onClick={() => !busy && pickMood('okay')} />
            <Choice
              emoji="😟"
              label="A little rough"
              selected={false}
              onClick={() => !busy && pickMood('rough')}
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
              onClick={() => !busy && pickMeds(true)}
            />
            <Choice
              emoji="⏰"
              label="Not yet — I'll do it soon"
              selected={false}
              onClick={() => !busy && pickMeds(false)}
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
              {deviceError && (
                <div className="card-flat" style={{ borderColor: 'var(--alert)' }}>
                  <p style={{ fontSize: 17, color: 'var(--alert)' }}>{deviceError}</p>
                  <p className="tiny">You can use a simulated reading instead.</p>
                </div>
              )}
              <div className="grow" />
              {isBluetoothSupported() && (
                <button className="btn btn-primary btn-lg" onClick={() => takeReading(true)}>
                  ❤️ Connect my Bluetooth cuff
                </button>
              )}
              <button
                className={isBluetoothSupported() ? 'btn btn-secondary' : 'btn btn-primary btn-lg'}
                onClick={() => takeReading(false)}
              >
                {isBluetoothSupported() ? 'Use a simulated reading' : '❤️ Start my reading'}
              </button>
              {!isBluetoothSupported() && (
                <p className="tiny" style={{ textAlign: 'center' }}>
                  This browser can't reach Bluetooth — using a simulated cuff.
                </p>
              )}
            </>
          )}

          {measuring && (
            <div className="center-col grow" style={{ justifyContent: 'center' }}>
              <div style={{ fontSize: 60, animation: 'pop 1s ease-in-out infinite alternate' }}>
                ❤️
              </div>
              <h2>Measuring…</h2>
              <p className="muted">Stay relaxed and still — almost done.</p>
            </div>
          )}

          {reading && (
            <>
              <div className="card center-col">
                <span className="pill pill-leaf">
                  Reading saved {reading.source === 'bluetooth-cuff' ? '• via cuff' : ''}
                </span>
                <div className="row" style={{ gap: 24 }}>
                  <div>
                    <div className="big-number">
                      {reading.sys}/{reading.dia}
                    </div>
                    <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                      blood pressure
                    </p>
                  </div>
                  {reading.heartRate != null && (
                    <div>
                      <div className="big-number">{reading.heartRate}</div>
                      <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                        heart rate
                      </p>
                    </div>
                  )}
                </div>
                {alerts.length > 0 ? (
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--alert)' }}>
                    We've shared this with your care team — they'll reach out. 💛
                  </p>
                ) : (
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--leaf)' }}>
                    Looking good — your numbers are in a healthy range. 💚
                  </p>
                )}
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
