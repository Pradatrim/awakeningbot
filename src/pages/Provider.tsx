import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';
import Qr from '../components/Qr';
import { api } from '../api';
import type { Invite } from '../store/types';

/**
 * Flow A — the doctor's screen.
 * The doctor places the RPM order during the visit. One action
 * creates the order, establishes medical necessity, and produces
 * a pre-bound invite the patient scans before leaving the room.
 */
export default function Provider() {
  const nav = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [patientName, setPatientName] = useState('');

  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [mbi, setMbi] = useState('');
  const [provider, setProvider] = useState('Dr. Lopez — Sunrise Family Medicine');
  const [diagnosis, setDiagnosis] = useState('Hypertension (I10)');

  function useSampleChart() {
    setFirst('Walter');
    setLast('Hughes');
    setDob('1948-11-02');
    setPhone('(555) 661-2090');
    setMbi('7QW3-FN8-PA41');
  }

  const ready = firstName && lastName && dob && phone && mbi && provider && diagnosis;

  async function placeOrder() {
    setBusy(true);
    setError('');
    try {
      const r = await api.enrollProvider({
        patient: { firstName, lastName, dob, phone, mbi },
        orderingProvider: provider,
        diagnosis,
      });
      setPatientName(firstName);
      setInvite(r.invite);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (invite) {
    const link = `${window.location.origin}/join/${invite.token}`;
    return (
      <div className="screen screen-scroll fade-in">
        <TopBar title="Order placed" onBack={() => nav('/')} />
        <div className="center-col">
          <span className="pill pill-leaf">✓ RPM order created</span>
          <h2>Have {patientName} scan this</h2>
          <p className="muted" style={{ fontSize: 18 }}>
            The app opens already as them — no typing, no account to make. Walk them through it
            before they leave the room.
          </p>
          <div className="card" style={{ padding: 16 }}>
            <Qr value={link} />
          </div>
          <p className="tiny">Or open the pre-bound link directly:</p>
          <button className="btn btn-primary" onClick={() => nav(`/join/${invite.token}`)}>
            Open the patient's invite →
          </button>
        </div>

        <div className="card-flat stack">
          <div className="row-between">
            <span className="muted">Patient state</span>
            <span className="pill pill-sun">pending-order</span>
          </div>
          <p className="tiny">
            The order is on file, so {patientName} flips to <strong>covered</strong> the moment
            they finish e-consent. Billing never fires before that.
          </p>
        </div>

        <button className="btn btn-ghost" onClick={() => nav('/')}>
          Back to start
        </button>
      </div>
    );
  }

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar title="Place RPM order" onBack={() => nav('/')} />
      <p className="muted" style={{ fontSize: 18 }}>
        Fields are pulled from your EHR chart in production. Confirm and place the order.
      </p>

      <button className="btn btn-secondary" onClick={useSampleChart}>
        ⤵ Use a sample chart patient
      </button>

      <div className="stack">
        <Field label="First name" value={firstName} onChange={setFirst} />
        <Field label="Last name" value={lastName} onChange={setLast} />
        <Field label="Date of birth" value={dob} onChange={setDob} placeholder="YYYY-MM-DD" />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Medicare number (MBI)" value={mbi} onChange={setMbi} />
        <Field label="Ordering provider" value={provider} onChange={setProvider} />
        <Field label="Diagnosis / medical necessity" value={diagnosis} onChange={setDiagnosis} />
      </div>

      {error && (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={placeOrder}>
        {busy ? 'Placing order…' : 'Place order & create invite'}
      </button>
    </div>
  );
}

function Field({
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
