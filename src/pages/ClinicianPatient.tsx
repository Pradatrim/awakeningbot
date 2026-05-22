import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loading, TopBar } from '../components/ui';
import BillingCard from '../components/BillingCard';
import { api, getClinicianToken } from '../api';
import type { Alert, DailyLog, Patient } from '../store/types';

const SEV: Record<string, { cls: string; icon: string }> = {
  high: { cls: 'pill-alert', icon: '⚠️' },
  medium: { cls: 'pill-sun', icon: '●' },
  low: { cls: 'pill-sun', icon: '•' },
};

/** Systolic trend over recent check-ins. */
function Sparkline({ logs }: { logs: DailyLog[] }) {
  const readings = logs
    .filter((l) => l.bp)
    .slice(0, 14)
    .reverse();
  if (readings.length < 2) return null;

  const w = 300;
  const h = 90;
  const vals = readings.map((r) => r.bp!.sys);
  const min = Math.min(...vals) - 6;
  const max = Math.max(...vals) + 6;
  const x = (i: number) => (i / (readings.length - 1)) * (w - 16) + 8;
  const y = (v: number) => h - 12 - ((v - min) / (max - min)) * (h - 24);
  const path = readings.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.bp!.sys)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Systolic trend">
      {/* 140 mmHg reference line */}
      {140 > min && 140 < max && (
        <line x1="8" y1={y(140)} x2={w - 8} y2={y(140)} stroke="var(--line)" strokeWidth="2" strokeDasharray="4 4" />
      )}
      <path d={path} fill="none" stroke="var(--sun-deep)" strokeWidth="3" strokeLinejoin="round" />
      {readings.map((r, i) => (
        <circle
          key={r.date}
          cx={x(i)}
          cy={y(r.bp!.sys)}
          r="4"
          fill={r.bp!.sys >= 140 ? 'var(--alert)' : 'var(--leaf)'}
        />
      ))}
    </svg>
  );
}

/** Full patient chart for the care team. */
export default function ClinicianPatient() {
  const nav = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<{ patient: Patient; alerts: Alert[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    api
      .clinicianPatient(id)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(() => {
    if (!getClinicianToken()) {
      nav('/clinician/login');
      return;
    }
    load();
  }, [load, nav]);

  if (error) {
    return (
      <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2>{error}</h2>
        <button className="btn btn-secondary" onClick={() => nav('/clinician')}>
          Back to panel
        </button>
      </div>
    );
  }
  if (!data) return <Loading label="Loading the chart…" />;

  const { patient, alerts } = data;
  const open = alerts.filter((a) => a.status === 'open');
  const resolved = alerts.filter((a) => a.status === 'resolved');
  const withBp = patient.logs.filter((l) => l.bp);

  async function resolve(alertId: string) {
    setBusy(true);
    try {
      await api.resolveAlert(alertId);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function requestCall() {
    setBusy(true);
    try {
      await api.requestCall(patient.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar title="Patient chart" onBack={() => nav('/clinician')} />

      <div className="card stack">
        <h2>
          {patient.firstName} {patient.lastName}
        </h2>
        <div className="row-between">
          <span className="muted" style={{ fontSize: 16 }}>
            DOB {patient.dob}
          </span>
          <span className="pill pill-sun">{patient.state}</span>
        </div>
        <p className="muted" style={{ fontSize: 16 }}>
          {patient.phone} • MBI {patient.mbi}
        </p>
        {patient.order && (
          <p className="tiny">
            RPM order: {patient.order.diagnosis} — {patient.order.orderingProvider}
          </p>
        )}
      </div>

      {/* open alerts */}
      {open.length > 0 && (
        <>
          <h3>Open alerts</h3>
          <div className="stack">
            {open.map((a) => (
              <div key={a.id} className="card-flat stack" style={{ borderColor: 'var(--line)' }}>
                <div className="row-between">
                  <span className={`pill ${SEV[a.severity].cls}`}>
                    {SEV[a.severity].icon} {a.severity}
                  </span>
                  <span className="tiny">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 600 }}>{a.message}</p>
                <button className="btn btn-secondary" disabled={busy} onClick={() => resolve(a.id)}>
                  ✓ Mark resolved
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* vitals trend */}
      <h3>Blood pressure trend</h3>
      <div className="card">
        {withBp.length >= 2 ? (
          <>
            <Sparkline logs={patient.logs} />
            <p className="tiny" style={{ textAlign: 'center' }}>
              Systolic, recent check-ins. Dashed line = 140 mmHg.
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 16 }}>
            Not enough readings yet to chart a trend.
          </p>
        )}
      </div>

      {/* recent readings */}
      {withBp.length > 0 && (
        <div className="stack">
          {withBp.slice(0, 6).map((l) => (
            <div key={l.date} className="card-flat row-between">
              <span style={{ fontSize: 16, fontWeight: 700 }}>{l.date}</span>
              <span className="muted" style={{ fontSize: 16 }}>
                {l.bp!.sys}/{l.bp!.dia} • {l.heartRate ?? '—'} bpm • {l.source ?? 'manual'}
              </span>
            </div>
          ))}
        </div>
      )}

      <BillingCard patientId={patient.id} />

      <button className="btn btn-secondary" disabled={busy} onClick={requestCall}>
        📞 Request an outreach call
      </button>

      {resolved.length > 0 && (
        <>
          <h3>Resolved ({resolved.length})</h3>
          <div className="stack">
            {resolved.slice(0, 5).map((a) => (
              <div key={a.id} className="card-flat row-between">
                <span className="muted" style={{ fontSize: 15 }}>
                  {a.message}
                </span>
                <span className="pill pill-leaf">✓</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
