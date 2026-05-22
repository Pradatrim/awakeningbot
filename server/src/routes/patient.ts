/* ============================================================
   Patient app routes — require a patient session JWT.
   ============================================================ */

import { Router } from 'express';
import { requireScope } from '../auth.js';
import { loadPatient } from '../model.js';
import { recordCheckIn } from '../logic.js';
import { runAlertRules } from '../alerts.js';

export const patient = Router();

patient.use(requireScope('patient'));

/** The signed-in patient's full record. */
patient.get('/me', (req, res) => {
  const p = loadPatient(req.principal!.sub);
  if (!p) return res.status(404).json({ error: 'Patient not found.' });
  res.json({ patient: p });
});

/** Records (or merges) today's check-in and runs the alert rules. */
patient.post('/checkin', (req, res) => {
  const pid = req.principal!.sub;
  const { mood, tookMeds, bp, heartRate, source } = req.body ?? {};

  if (bp && (typeof bp.sys !== 'number' || typeof bp.dia !== 'number')) {
    return res.status(400).json({ error: 'Blood pressure must be two numbers.' });
  }

  const { log, logId } = recordCheckIn(pid, { mood, tookMeds, bp, heartRate, source });
  // Alerts are evaluated once the day's full picture (including
  // the BP reading) is in — not on each partial step.
  const alerts = log.complete ? runAlertRules(pid, logId, log) : [];

  res.json({ patient: loadPatient(pid), log, alerts });
});
