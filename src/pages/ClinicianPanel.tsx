import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../components/ui';
import { api, getClinicianToken, setClinicianToken } from '../api';
import type { PanelPatient } from '../store/types';

const SEVERITY: Record<string, { cls: string; label: string }> = {
  high: { cls: 'pill-alert', label: 'Needs attention' },
  medium: { cls: 'pill-sun', label: 'Review' },
  low: { cls: 'pill-sun', label: 'Note' },
};

/** The care team's working view — every monitored patient. */
export default function ClinicianPanel() {
  const nav = useNavigate();
  const [rows, setRows] = useState<PanelPatient[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getClinicianToken()) {
      nav('/clinician/login');
      return;
    }
    api
      .panel()
      .then(setRows)
      .catch((e) => {
        setError((e as Error).message);
        setRows([]);
      });
  }, [nav]);

  if (!rows && !error) return <Loading label="Loading the care panel…" />;

  const needAttention = rows?.filter((r) => r.topSeverity).length ?? 0;

  return (
    <div className="screen screen-scroll fade-in">
      <div className="row-between">
        <div>
          <p className="muted" style={{ fontSize: 16 }}>
            Medisun care team
          </p>
          <h1>Care panel</h1>
        </div>
        <button
          className="back"
          aria-label="Sign out"
          onClick={() => {
            setClinicianToken(null);
            nav('/');
          }}
        >
          ⏻
        </button>
      </div>

      <div
        className={`pill ${needAttention ? 'pill-alert' : 'pill-leaf'}`}
        style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 16 }}
      >
        {needAttention
          ? `${needAttention} patient${needAttention === 1 ? ' needs' : 's need'} attention`
          : '✓ All patients reviewed — nothing flagged'}
      </div>

      {error && (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}

      <div className="stack">
        {rows?.map((p) => {
          const sev = p.topSeverity ? SEVERITY[p.topSeverity] : null;
          return (
            <button
              key={p.id}
              className="card stack"
              style={{ textAlign: 'left', alignItems: 'stretch' }}
              onClick={() => nav(`/clinician/patient/${p.id}`)}
            >
              <div className="row-between">
                <h3>
                  {p.firstName} {p.lastName}
                </h3>
                {sev ? (
                  <span className={`pill ${sev.cls}`}>
                    {p.topSeverity === 'high' ? '⚠️ ' : ''}
                    {p.openAlertCount} open
                  </span>
                ) : (
                  <span className="pill pill-leaf">✓ clear</span>
                )}
              </div>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 16 }}>
                  {p.latestReading?.bp
                    ? `Last BP ${p.latestReading.bp.sys}/${p.latestReading.bp.dia}`
                    : 'No readings yet'}
                </span>
                <span className="muted" style={{ fontSize: 16 }}>
                  🔥 {p.streak} • {p.state}
                </span>
              </div>
            </button>
          );
        })}
        {rows && rows.length === 0 && !error && (
          <div className="card-flat center-col">
            <span style={{ fontSize: 36 }}>🌅</span>
            <p style={{ fontSize: 18, fontWeight: 700 }}>No monitored patients yet</p>
            <p className="tiny">Enrolled patients appear here once their order is on file.</p>
          </div>
        )}
      </div>
    </div>
  );
}
