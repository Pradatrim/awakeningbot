import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading, TopBar } from '../components/ui';
import { api, getClinicianToken } from '../api';
import type { Claim } from '../store/types';

const STATUS: Record<string, string> = {
  draft: 'pill-sun',
  submitted: 'pill-sun',
  paid: 'pill-leaf',
  denied: 'pill-alert',
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** All RPM claims across patients. */
export default function ClaimsList() {
  const nav = useNavigate();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getClinicianToken()) {
      nav('/clinician/login');
      return;
    }
    api
      .claims()
      .then(setClaims)
      .catch((e) => {
        setError((e as Error).message);
        setClaims([]);
      });
  }, [nav]);

  if (!claims && !error) return <Loading label="Loading claims…" />;

  const submittedValue = (claims ?? [])
    .filter((c) => c.status === 'submitted' || c.status === 'paid')
    .reduce((s, c) => s + c.totalCharge, 0);
  const collected = (claims ?? [])
    .filter((c) => c.status === 'paid')
    .reduce((s, c) => s + (c.payerPaid ?? 0), 0);

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar title="RPM claims" onBack={() => nav('/clinician')} />

      <div className="row" style={{ gap: 12 }}>
        <div className="card" style={{ flex: 1 }}>
          <p className="tiny">Billed</p>
          <div className="big-number" style={{ fontSize: 26 }}>
            {money(submittedValue)}
          </div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <p className="tiny">Collected</p>
          <div className="big-number" style={{ fontSize: 26, color: 'var(--leaf)' }}>
            {money(collected)}
          </div>
        </div>
      </div>

      {error && (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}

      <div className="stack">
        {claims?.map((c) => (
          <button
            key={c.id}
            className="card stack"
            style={{ textAlign: 'left', alignItems: 'stretch' }}
            onClick={() => nav(`/clinician/claim/${c.id}`)}
          >
            <div className="row-between">
              <h3>{c.patientName}</h3>
              <span className={`pill ${STATUS[c.status]}`}>{c.status}</span>
            </div>
            <div className="row-between">
              <span className="muted" style={{ fontSize: 16 }}>
                {c.period} • {c.lines.length} line{c.lines.length === 1 ? '' : 's'} • Dx{' '}
                {c.diagnosisCode}
              </span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{money(c.totalCharge)}</span>
            </div>
          </button>
        ))}
        {claims && claims.length === 0 && !error && (
          <div className="card-flat center-col">
            <span style={{ fontSize: 36 }}>🧾</span>
            <p style={{ fontSize: 18, fontWeight: 700 }}>No claims yet</p>
            <p className="tiny">
              Open a patient chart and generate a claim from their billing card.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
