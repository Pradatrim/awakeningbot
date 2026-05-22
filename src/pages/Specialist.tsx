import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar, Choice } from '../components/ui';
import Qr from '../components/Qr';
import { enrollFromSpecialist, fulfillOrder } from '../store/store';
import { runEligibilityCheck } from '../store/eligibility';
import type { EligibilityResult, Invite, OrderSource } from '../store/types';

type Step = 'intake' | 'result' | 'done';

const SPECIALIST = 'M. Alvarez (enrollment specialist)';

/**
 * Flow B — the enrollment specialist's console.
 * The patient called in from an ad. The specialist does intake,
 * runs the eligibility check live on the call, solves the
 * physician order, captures verbal consent, and texts a
 * pre-bound link. No dead ends — ineligible callers are routed
 * to the free self-tracking tier.
 */
export default function Specialist() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('intake');

  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [mbi, setMbi] = useState('');

  const [checking, setChecking] = useState(false);
  const [elig, setElig] = useState<EligibilityResult | null>(null);

  const [orderPlan, setOrderPlan] = useState<OrderSource | null>(null);
  const [verbalConsent, setVerbalConsent] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);
  const [orderFulfilled, setOrderFulfilled] = useState(false);

  function sample() {
    setFirst('Doris');
    setLast('Pham');
    setDob('1945-07-19');
    setPhone('(555) 938-1144');
    setMbi('3MT9-WC2-HE08');
  }

  const intakeReady = firstName && lastName && dob && phone && mbi;

  async function runCheck() {
    setChecking(true);
    const result = await runEligibilityCheck(mbi);
    setElig(result);
    setChecking(false);
    setStep('result');
  }

  function sendLink() {
    if (!elig) return;
    const inv = enrollFromSpecialist({
      patient: { firstName, lastName, dob, phone, mbi },
      eligibility: elig,
      consent: { givenAt: new Date().toISOString(), method: 'verbal', documentedBy: SPECIALIST },
    });
    setInvite(inv);
    setCreatedPatientId(inv.patientId);
    setStep('done');
  }

  /* ---------- intake ---------- */
  if (step === 'intake') {
    return (
      <div className="screen screen-scroll fade-in">
        <TopBar title="Enrollment call" onBack={() => nav('/')} />
        <span className="pill pill-sun">📞 On a call with a new caller</span>
        <p className="muted" style={{ fontSize: 18 }}>
          Take the caller's details, then run their Medicare check while they're on the line.
        </p>

        <button className="btn btn-secondary" onClick={sample}>
          ⤵ Use a sample caller
        </button>

        <div className="stack">
          <SField label="First name" value={firstName} onChange={setFirst} />
          <SField label="Last name" value={lastName} onChange={setLast} />
          <SField label="Date of birth" value={dob} onChange={setDob} placeholder="YYYY-MM-DD" />
          <SField label="Phone" value={phone} onChange={setPhone} />
          <SField label="Medicare number (MBI)" value={mbi} onChange={setMbi} />
        </div>

        <button
          className="btn btn-primary btn-lg"
          disabled={!intakeReady || checking}
          onClick={runCheck}
        >
          {checking ? 'Checking Medicare…' : 'Run eligibility check'}
        </button>
        {checking && (
          <p className="tiny" style={{ textAlign: 'center' }}>
            Contacting the clearinghouse — this takes a few seconds.
          </p>
        )}
      </div>
    );
  }

  /* ---------- eligibility result ---------- */
  if (step === 'result' && elig) {
    return (
      <div className="screen screen-scroll fade-in">
        <TopBar title="Eligibility result" onBack={() => setStep('intake')} />

        <div className={`card stack`}>
          <span className={`pill ${elig.eligible ? 'pill-leaf' : 'pill-alert'}`}>
            {elig.eligible ? '✓ Covered' : '✕ Not covered'}
          </span>
          <h2>{elig.message}</h2>
          <p className="muted">{elig.plan}</p>
          {elig.eligible && (
            <p style={{ fontSize: 19 }}>
              Tell the caller now: <strong>${elig.monthlyCost}/month</strong> to them.
            </p>
          )}
        </div>

        {elig.eligible ? (
          <>
            <h3>Solve the physician order</h3>
            <Choice
              emoji="🩺"
              label="Request the order from the caller's own doctor"
              selected={orderPlan === 'doctor-referral'}
              onClick={() => setOrderPlan('doctor-referral')}
            />
            <Choice
              emoji="📅"
              label="Schedule a Medisun clinician virtual visit (same/next day)"
              selected={orderPlan === 'medisun-clinician'}
              onClick={() => setOrderPlan('medisun-clinician')}
            />

            <button
              className={`choice${verbalConsent ? ' selected' : ''}`}
              onClick={() => setVerbalConsent(!verbalConsent)}
              aria-pressed={verbalConsent}
            >
              <span className="emoji">{verbalConsent ? '☑' : '☐'}</span>
              <span style={{ flex: 1, fontSize: 18 }}>
                Caller gave verbal consent — documented by {SPECIALIST}
              </span>
            </button>

            <button
              className="btn btn-primary btn-lg"
              disabled={!orderPlan || !verbalConsent}
              onClick={sendLink}
            >
              Text the pre-bound link
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 18 }}>
              No dead end — set the caller up on the free self-tracking tier so they still get a
              daily check-in.
            </p>
            <button className="btn btn-primary btn-lg" onClick={sendLink}>
              Route to the free tier & send link
            </button>
          </>
        )}
      </div>
    );
  }

  /* ---------- done ---------- */
  if (step === 'done' && invite) {
    const link = `${window.location.origin}/join/${invite.token}`;
    const eligible = elig?.eligible ?? false;
    return (
      <div className="screen screen-scroll fade-in">
        <TopBar title="Link sent" onBack={() => nav('/')} />
        <div className="center-col">
          <span className="pill pill-leaf">✓ Texted to {phone}</span>
          <h2>{firstName}'s app is pre-bound</h2>
          <p className="muted" style={{ fontSize: 18 }}>
            They tap the link and the app opens already as them. Devices ship to their home.
          </p>
          <div className="card" style={{ padding: 16 }}>
            <Qr value={link} />
          </div>
          <button className="btn btn-primary" onClick={() => nav(`/join/${invite.token}`)}>
            Open {firstName}'s invite →
          </button>
        </div>

        {eligible && (
          <div className="card-flat stack">
            <div className="row-between">
              <span className="muted">Patient state</span>
              <span className="pill pill-sun">
                {orderFulfilled ? 'covered' : 'pending-order'}
              </span>
            </div>
            {orderFulfilled ? (
              <p className="tiny">
                ✓ Establishing visit produced the order. Billing is now active.
              </p>
            ) : (
              <>
                <p className="tiny">
                  No order yet — nothing is billed. When the establishing visit produces the
                  order, the patient flips to covered.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (!createdPatientId) return;
                    fulfillOrder({
                      patientId: createdPatientId,
                      source: orderPlan ?? 'medisun-clinician',
                      orderingProvider:
                        orderPlan === 'doctor-referral'
                          ? "Caller's referring physician"
                          : 'Medisun-affiliated clinician',
                      diagnosis: 'Chronic condition — RPM (established on visit)',
                    });
                    setOrderFulfilled(true);
                  }}
                >
                  ✓ Mark establishing visit complete
                </button>
              </>
            )}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => nav('/')}>
          Back to start
        </button>
      </div>
    );
  }

  return null;
}

function SField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
