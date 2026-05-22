import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

/** One RPM claim — service lines, the 837P EDI, and the
 *  draft → submitted → paid lifecycle. */
export default function ClaimDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEdi, setShowEdi] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api
      .claim(id)
      .then(setClaim)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(() => {
    if (!getClinicianToken()) {
      nav('/clinician/login');
      return;
    }
    load();
  }, [load, nav]);

  if (error && !claim) {
    return (
      <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2>{error}</h2>
        <button className="btn btn-secondary" onClick={() => nav('/clinician/billing')}>
          Back to claims
        </button>
      </div>
    );
  }
  if (!claim) return <Loading label="Loading claim…" />;

  async function act(fn: () => Promise<Claim>) {
    setBusy(true);
    setError('');
    try {
      setClaim(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar title="RPM claim" onBack={() => nav('/clinician/billing')} />

      <div className="card stack">
        <div className="row-between">
          <h2>{claim.patientName}</h2>
          <span className={`pill ${STATUS[claim.status]}`}>{claim.status}</span>
        </div>
        <p className="muted" style={{ fontSize: 16 }}>
          Period {claim.period} • {claim.payer} • Dx {claim.diagnosisCode}
        </p>
        {claim.controlNumber && (
          <p className="tiny">837P control #{claim.controlNumber}</p>
        )}
      </div>

      {/* service lines */}
      <h3>Service lines</h3>
      <div className="stack">
        {claim.lines.map((ln) => (
          <div key={ln.id} className="card-flat stack" style={{ gap: 4 }}>
            <div className="row-between">
              <span style={{ fontSize: 17, fontWeight: 700 }}>CPT {ln.cpt}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{money(ln.charge)}</span>
            </div>
            <p className="tiny">{ln.description}</p>
            <p className="tiny" style={{ color: 'var(--ink-soft)' }}>
              {ln.units} unit{ln.units === 1 ? '' : 's'} @ {money(ln.rate)} • {ln.serviceFrom} →{' '}
              {ln.serviceTo}
            </p>
          </div>
        ))}
      </div>

      <div className="card stack">
        <div className="row-between">
          <span style={{ fontSize: 17, fontWeight: 700 }}>Total charge</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{money(claim.totalCharge)}</span>
        </div>
        {claim.status === 'paid' && (
          <>
            <div className="row-between">
              <span className="muted">Medicare paid (80%)</span>
              <span style={{ fontWeight: 700, color: 'var(--leaf)' }}>
                {money(claim.payerPaid ?? 0)}
              </span>
            </div>
            <div className="row-between">
              <span className="muted">Patient responsibility (20%)</span>
              <span style={{ fontWeight: 700 }}>{money(claim.patientResponsibility ?? 0)}</span>
            </div>
          </>
        )}
        {claim.status === 'denied' && claim.denialReason && (
          <p className="tiny" style={{ color: 'var(--alert)' }}>
            Denied — {claim.denialReason}
          </p>
        )}
      </div>

      {/* 837P EDI */}
      {claim.x12_837 && (
        <>
          <button className="btn btn-secondary" onClick={() => setShowEdi(!showEdi)}>
            {showEdi ? 'Hide' : 'View'} 837P EDI
          </button>
          {showEdi && (
            <div
              className="card-flat"
              style={{
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {claim.x12_837.split('~').filter(Boolean).join('~\n')}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}

      {/* lifecycle actions */}
      {claim.status === 'draft' && (
        <button
          className="btn btn-primary btn-lg"
          disabled={busy}
          onClick={() => act(() => api.submitClaim(claim.id))}
        >
          {busy ? 'Submitting…' : '📤 Submit to Medicare'}
        </button>
      )}
      {claim.status === 'submitted' && (
        <>
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => act(() => api.remitClaim(claim.id, 'paid'))}
          >
            {busy ? 'Posting…' : '💵 Post payment (835 remittance)'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => act(() => api.remitClaim(claim.id, 'denied'))}
          >
            Record a denial
          </button>
        </>
      )}
      {(claim.status === 'paid' || claim.status === 'denied') && (
        <button className="btn btn-secondary" onClick={() => nav('/clinician/billing')}>
          Back to claims
        </button>
      )}
    </div>
  );
}
