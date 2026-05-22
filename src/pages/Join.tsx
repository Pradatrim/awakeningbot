import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dots } from '../components/ui';
import Sun from '../components/Sun';
import { api } from '../api';
import { adoptSession } from '../store/store';
import type { Eligibility, Invite, Patient } from '../store/types';

type Step = 'welcome' | 'confirm' | 'eligibility' | 'consent' | 'done';
const STEPS: Step[] = ['welcome', 'confirm', 'eligibility', 'consent'];

/**
 * The pre-bound onboarding. Both flows land here: a tokenized
 * link opens the app already tied to a patient record, so there
 * is almost nothing to type. Target: about one minute.
 */
export default function Join() {
  const { token } = useParams();
  const nav = useNavigate();

  const [data, setData] = useState<{ invite: Invite; patient: Patient } | null>(null);
  const [loadError, setLoadError] = useState('');

  const [step, setStep] = useState<Step>('welcome');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [mbi, setMbi] = useState('');
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finalState, setFinalState] = useState<string | null>(null);

  // Load the pre-bound invite.
  useEffect(() => {
    if (!token) {
      setLoadError('missing');
      return;
    }
    api
      .getInvite(token)
      .then((r) => {
        setData(r);
        setFirst(r.patient.firstName);
        setLast(r.patient.lastName);
        setDob(r.patient.dob);
        setPhone(r.patient.phone);
        setMbi(r.patient.mbi);
        if (r.patient.eligibility) setElig(r.patient.eligibility);
      })
      .catch(() => setLoadError('invalid'));
  }, [token]);

  // Run the eligibility check on entering that step, if needed.
  useEffect(() => {
    if (step !== 'eligibility' || elig || checking) return;
    setChecking(true);
    api
      .checkEligibility({ mbi, firstName: first, lastName: last, dob })
      .then((r) => setElig(r))
      .catch(() => setLoadError('eligibility'))
      .finally(() => setChecking(false));
  }, [step, elig, checking, mbi, first, last, dob]);

  if (loadError && !data) {
    return (
      <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 54 }}>🔍</div>
        <h2>This invite link isn't valid</h2>
        <p className="muted">Ask your doctor or specialist to send a fresh link.</p>
        <button className="btn btn-secondary" onClick={() => nav('/')}>
          Back to start
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
        <div className="pop" style={{ fontSize: 48 }}>🌅</div>
        <h2>Opening your invite…</h2>
      </div>
    );
  }

  const fromDoctor = data.invite.channel === 'flow-a-doctor';

  async function confirmInfo() {
    setBusy(true);
    try {
      await api.confirmInvite(token!, { firstName: first, lastName: last, dob, phone, mbi });
      setStep('eligibility');
    } catch {
      setLoadError('confirm');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const r = await api.completeInvite(token!, {
        eligibility: elig ?? undefined,
        consent: { givenAt: new Date().toISOString(), method: 'e-consent' },
      });
      adoptSession(r.sessionToken, r.patient);
      setFinalState(r.state);
      setStep('done');
    } catch {
      setLoadError('complete');
    } finally {
      setBusy(false);
    }
  }

  /* ---------- welcome ---------- */
  if (step === 'welcome') {
    return (
      <div className="screen fade-in">
        <div className="grow" />
        <Sun progress={0.25} height={170} />
        <div className="center-col">
          <h1>Welcome, {data.patient.firstName}.</h1>
          <p className="lead">
            {fromDoctor
              ? 'Your doctor set this up for you. Everything is almost ready — just confirm a few things.'
              : "We've started your sign-up. Let's finish it together — it only takes a minute."}
          </p>
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => setStep('confirm')}>
          Let's begin
        </button>
        <Dots count={STEPS.length} active={0} />
      </div>
    );
  }

  /* ---------- confirm pre-filled info ---------- */
  if (step === 'confirm') {
    return (
      <div className="screen screen-scroll fade-in">
        <h1>Is this you?</h1>
        <p className="lead">We filled this in for you. Fix anything that looks wrong.</p>

        <div className="stack">
          <JField label="First name" value={first} onChange={setFirst} />
          <JField label="Last name" value={last} onChange={setLast} />
          <JField label="Date of birth" value={dob} onChange={setDob} />
          <JField label="Phone" value={phone} onChange={setPhone} />
          {mbi ? (
            <JField label="Medicare number" value={mbi} onChange={setMbi} />
          ) : (
            <div className="card-flat stack">
              <label style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>Medicare number</label>
              <p className="tiny">We don't have this yet. Scan your red, white & blue card.</p>
              <button className="btn btn-secondary" onClick={() => setMbi('5KP2-RT9-LM63')}>
                📷 Scan my Medicare card
              </button>
            </div>
          )}
        </div>

        <div className="grow" />
        <button
          className="btn btn-primary btn-lg"
          disabled={!first || !last || !dob || !phone || !mbi || busy}
          onClick={confirmInfo}
        >
          {busy ? 'Saving…' : "Yes, that's me"}
        </button>
        <Dots count={STEPS.length} active={1} />
      </div>
    );
  }

  /* ---------- eligibility ---------- */
  if (step === 'eligibility') {
    if (checking || !elig) {
      return (
        <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
          <div className="pop" style={{ fontSize: 54 }}>🛡️</div>
          <h2>Checking your Medicare coverage…</h2>
          <p className="muted">This only takes a few seconds. Hang tight.</p>
          <div className="dots">
            <span className="dot on" />
            <span className="dot on" />
            <span className="dot" />
          </div>
        </div>
      );
    }
    return (
      <div className="screen screen-scroll fade-in">
        <div className="center-col">
          <div className="pop" style={{ fontSize: 54 }}>{elig.eligible ? '🎉' : '💛'}</div>
          <h1>{elig.eligible ? 'Good news!' : "Here's the plan"}</h1>
        </div>
        <div className="card stack">
          <span className={`pill ${elig.eligible ? 'pill-leaf' : 'pill-sun'}`}>{elig.plan}</span>
          <p style={{ fontSize: 21 }}>{elig.message}</p>
          {elig.eligible ? (
            <h2 style={{ color: 'var(--leaf)' }}>Your cost: ${elig.monthlyCost} per month</h2>
          ) : (
            <p className="muted">
              You'll join our free health tier — a daily check-in, always at no cost.
            </p>
          )}
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => setStep('consent')}>
          Continue
        </button>
        <Dots count={STEPS.length} active={2} />
      </div>
    );
  }

  /* ---------- consent ---------- */
  if (step === 'consent' && elig) {
    const billed = elig.eligible;
    return (
      <div className="screen screen-scroll fade-in">
        <h1>One last thing</h1>
        <div className="card stack">
          {billed ? (
            <>
              <p style={{ fontSize: 19 }}>
                I'd like to join <strong>Medisun Care</strong> remote monitoring. I understand:
              </p>
              <ul style={{ paddingLeft: 22, fontSize: 18, lineHeight: 1.6 }}>
                <li>My doctor will see my daily numbers.</li>
                <li>
                  Medicare is billed for this service. My share is{' '}
                  <strong>${elig.monthlyCost}/month</strong>.
                </li>
                <li>I can stop any time, with one tap.</li>
              </ul>
            </>
          ) : (
            <p style={{ fontSize: 19 }}>
              I'd like to use <strong>Medisun Care</strong> free health tracking. There is no cost
              and no billing. I can stop any time.
            </p>
          )}
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={complete}>
          {busy ? 'Enrolling…' : billed ? 'I agree — enroll me' : 'I agree — set me up'}
        </button>
        <p className="tiny" style={{ textAlign: 'center' }}>
          Tapping the button is your signature.
        </p>
        <Dots count={STEPS.length} active={3} />
      </div>
    );
  }

  /* ---------- done ---------- */
  if (step === 'done' && finalState) {
    const copy: Record<string, { emoji: string; title: string; body: string }> = {
      covered: {
        emoji: '🌅',
        title: "You're all set!",
        body: 'You are enrolled and fully covered. Your daily sunrise is waiting.',
      },
      'pending-order': {
        emoji: '🌤️',
        title: "You're in!",
        body: "We're finalizing your doctor's order. You can start using the app right now — nothing is billed until the order is on file.",
      },
      'not-covered': {
        emoji: '💛',
        title: "You're set up!",
        body: 'You are on our free health tier. Your daily check-in is ready whenever you are.',
      },
      free: {
        emoji: '💛',
        title: "You're set up!",
        body: 'Your daily check-in is ready whenever you are.',
      },
    };
    const c = copy[finalState] ?? copy.free;
    return (
      <div className="screen fade-in">
        <div className="grow" />
        <Sun progress={0.7} height={180} />
        <div className="center-col">
          <div className="pop" style={{ fontSize: 50 }}>{c.emoji}</div>
          <h1>{c.title}</h1>
          <p className="lead">{c.body}</p>
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => nav('/home')}>
          Open my app
        </button>
      </div>
    );
  }

  return null;
}

function JField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
