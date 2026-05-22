/* ============================================================
   Clinician dashboard routes.

   Login is email + password. Everything else requires a
   clinician session JWT. The panel is the care team's working
   view: every monitored patient, their latest reading, and any
   open alerts — sorted so the patients who need attention float
   to the top.
   ============================================================ */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, id, now } from '../db.js';
import { issueToken, requireScope } from '../auth.js';
import { loadPatient, mapAlert, mapLog } from '../model.js';

export const clinician = Router();

const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/* ---- login (public) ---- */
clinician.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const row: any = db
    .prepare('SELECT * FROM clinicians WHERE email = ?')
    .get(String(email ?? '').toLowerCase());
  if (!row || !bcrypt.compareSync(String(password ?? ''), row.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  const token = issueToken({ scope: 'clinician', sub: row.id, name: row.name });
  res.json({ token, clinician: { id: row.id, name: row.name, email: row.email } });
});

/* ---- everything below requires a clinician session ---- */
clinician.use(requireScope('clinician'));

/** The care panel — one row per monitored patient. */
clinician.get('/panel', (_req, res) => {
  const patients: any[] = db
    .prepare("SELECT * FROM patients WHERE state IN ('covered','pending-order') ORDER BY created_at")
    .all();

  const rows = patients.map((p) => {
    const latest: any = db
      .prepare(
        'SELECT * FROM daily_logs WHERE patient_id = ? AND bp_sys IS NOT NULL ORDER BY date DESC LIMIT 1',
      )
      .get(p.id);
    const openAlerts: any[] = db
      .prepare("SELECT * FROM alerts WHERE patient_id = ? AND status = 'open'")
      .all(p.id);
    const topSeverity = openAlerts
      .map((a) => a.severity)
      .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a])[0];

    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      state: p.state,
      streak: p.streak,
      latestReading: latest ? mapLog(latest) : undefined,
      openAlertCount: openAlerts.length,
      topSeverity: topSeverity ?? undefined,
    };
  });

  rows.sort((a, b) => {
    const ra = SEVERITY_RANK[a.topSeverity ?? ''] ?? 0;
    const rb = SEVERITY_RANK[b.topSeverity ?? ''] ?? 0;
    if (ra !== rb) return rb - ra;
    return b.openAlertCount - a.openAlertCount;
  });

  res.json({ patients: rows });
});

/** Full chart for one patient. */
clinician.get('/patient/:id', (req, res) => {
  const p = loadPatient(req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found.' });
  const alerts: any[] = db
    .prepare('SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json({ patient: p, alerts: alerts.map(mapAlert) });
});

/** Resolve an alert. */
clinician.post('/alert/:id/resolve', (req, res) => {
  const alert: any = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found.' });
  db.prepare("UPDATE alerts SET status='resolved', resolved_at=?, resolved_by=? WHERE id=?").run(
    now(),
    req.principal!.name ?? 'care team',
    req.params.id,
  );
  res.json({ alert: mapAlert(db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id)) });
});

/** Log an outreach call request against the patient. */
clinician.post('/patient/:id/request-call', (req, res) => {
  const p: any = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found.' });
  const alertId = id('alt');
  db.prepare(
    `INSERT INTO alerts (id, patient_id, severity, message, status, created_at)
     VALUES (?, ?, 'low', ?, 'open', ?)`,
  ).run(
    alertId,
    req.params.id,
    `Outreach call requested by ${req.principal!.name ?? 'care team'}.`,
    now(),
  );
  res.json({ alert: mapAlert(db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId)) });
});
