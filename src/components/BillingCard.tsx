/* ============================================================
   Billing card — RPM claim readiness for one patient, this month.
   Shows the CPT assessment, lets the clinician log clinical time,
   and generates the claim.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { BillingAssessment } from '../store/types';

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function BillingCard({ patientId }: { patientId: string }) {
  const nav = useNavigate();
  const [a, setA] = useState<BillingAssessment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [logging, setLogging] = useState(false);
  const [minutes, setMinutes] = useState('15');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api
      .billingAssessment(patientId)
      .then(setA)
      .catch((e) => setError((e as Error).message));
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="card-flat">
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="card-flat">
        <p className="muted" style={{ fontSize: 16 }}>
          Loading billing…
        </p>
      </div>
    );
  }

  async function saveTime() {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.logTime({ patientId, minutes: m, note });
      setA(r.assessment);
      setLogging(false);
      setNote('');
      setMinutes('15');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const r = await api.generateClaim({ patientId });
      nav(`/clinician/claim/${r.claim.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const monthLabel = new Date(a.periodFrom + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const anyBillable = a.codes.some((c) => c.billable);

  return (
    <div className="card stack">
      <div className="row-between">
        <h3>Billing — {monthLabel}</h3>
        <span className="pill pill-sun">RPM</span>
      </div>

      {!a.eligibleToBill ? (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {a.blockReason}
        </p>
      ) : (
        <>
          <div className="row-between">
            <span className="muted" style={{ fontSize: 16 }}>
              {a.readingDays} reading days • {a.clinicalMinutes} min clinical time
            </span>
            <span className="tiny">Dx {a.dxCode}</span>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {a.codes.map((c) => (
              <div
                key={c.code}
                className="card-flat"
                style={{ padding: 12, borderColor: c.billable ? 'var(--leaf)' : 'var(--line)' }}
              >
                <div className="row-between">
                  <span style={{ fontSize: 16, fontWeight: 700 }}>
                    {c.billable ? '✅' : '⬜'} CPT {c.code}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: c.billable ? 'var(--leaf)' : 'var(--ink-soft)',
                    }}
                  >
                    {c.billable ? `${money(c.charge)} ×${c.units}` : '—'}
                  </span>
                </div>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {c.label}
                </p>
                <p className="tiny" style={{ color: c.billable ? 'var(--leaf)' : 'var(--ink-soft)' }}>
                  {c.reason}
                </p>
              </div>
            ))}
          </div>

          <div className="row-between">
            <span style={{ fontSize: 17, fontWeight: 700 }}>Billable this month</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{money(a.billableTotal)}</span>
          </div>

          {logging ? (
            <div className="card-flat stack">
              <div className="field">
                <label>Clinical minutes</label>
                <input
                  className="input"
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Note</label>
                <input
                  className="input"
                  value={note}
                  placeholder="e.g. reviewed BP trend, called patient"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={saveTime}>
                {busy ? 'Saving…' : 'Save clinical time'}
              </button>
              <button className="btn btn-ghost" onClick={() => setLogging(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setLogging(true)}>
              ⏱ Log clinical time
            </button>
          )}

          {error && (
            <p className="tiny" style={{ color: 'var(--alert)' }}>
              {error}
            </p>
          )}
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || !anyBillable}
            onClick={generate}
          >
            {anyBillable ? 'Generate claim →' : 'Nothing billable yet'}
          </button>
        </>
      )}
    </div>
  );
}
