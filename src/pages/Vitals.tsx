import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';
import { useStore } from '../store/store';
import type { DailyLog } from '../store/types';

function rating(log: DailyLog): { ok: boolean; text: string } {
  if (!log.bp) return { ok: true, text: 'No reading' };
  const healthy = log.bp.sys < 132 && log.bp.dia < 86;
  return healthy
    ? { ok: true, text: 'Healthy range' }
    : { ok: false, text: 'Care team notified' };
}

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const todayIso = new Date().toISOString().slice(0, 10);
  if (iso === todayIso) return 'Today';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A calm, readable history of the patient's vitals. */
export default function Vitals() {
  const nav = useNavigate();
  const patient = useStore((s) =>
    s.currentPatientId ? s.patients[s.currentPatientId] : undefined,
  );

  useEffect(() => {
    if (!patient) nav('/');
  }, [patient, nav]);
  if (!patient) return null;

  const withBp = patient.logs.filter((l) => l.bp);
  const latest = withBp[0];

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar title="My vitals" onBack={() => nav('/home')} />

      {latest ? (
        <div className="card center-col">
          <span className="pill pill-sun">Latest reading • {prettyDate(latest.date)}</span>
          <div className="row" style={{ gap: 28 }}>
            <div>
              <div className="big-number">
                {latest.bp!.sys}/{latest.bp!.dia}
              </div>
              <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                blood pressure
              </p>
            </div>
            <div>
              <div className="big-number">{latest.heartRate ?? '—'}</div>
              <p className="muted" style={{ fontSize: 16, textAlign: 'center' }}>
                heart rate
              </p>
            </div>
          </div>
          <span className={`pill ${rating(latest).ok ? 'pill-leaf' : 'pill-alert'}`}>
            {rating(latest).ok ? '💚 ' : '⚠️ '}
            {rating(latest).text}
          </span>
        </div>
      ) : (
        <div className="card-flat center-col">
          <span style={{ fontSize: 40 }}>❤️</span>
          <p style={{ fontSize: 19, fontWeight: 700 }}>No readings yet</p>
          <p className="muted">Do today's check-in to take your first reading.</p>
          <button className="btn btn-primary" onClick={() => nav('/checkin')}>
            Start my check-in
          </button>
        </div>
      )}

      {withBp.length > 1 && (
        <>
          <h3>Recent days</h3>
          <div className="stack">
            {withBp.slice(0, 8).map((log) => {
              const r = rating(log);
              return (
                <div className="card-flat row-between" key={log.date}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 700 }}>{prettyDate(log.date)}</p>
                    <p className="muted" style={{ fontSize: 16 }}>
                      {log.bp!.sys}/{log.bp!.dia} • {log.heartRate ?? '—'} bpm
                    </p>
                  </div>
                  <span className={`pill ${r.ok ? 'pill-leaf' : 'pill-alert'}`}>
                    {r.ok ? '💚' : '⚠️'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="card-flat stack">
        <p style={{ fontSize: 18, fontWeight: 700 }}>👩‍⚕️ Your care team</p>
        <p className="muted" style={{ fontSize: 17 }}>
          {patient.eligibility?.eligible
            ? 'A nurse reviews these numbers every day. If anything looks off, they call you first — you never have to wonder.'
            : 'Upgrade to covered monitoring to have a nurse review your numbers daily.'}
        </p>
      </div>
    </div>
  );
}
