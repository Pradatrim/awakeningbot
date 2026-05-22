/* ============================================================
   Alert rules.

   Runs after every check-in. Out-of-range vitals and a low mood
   raise alerts the clinician dashboard surfaces and triages.
   ============================================================ */

import { db, id, now } from './db.js';
import { mapAlert, type ApiAlert, type ApiLog } from './model.js';

interface Finding {
  severity: 'high' | 'medium' | 'low';
  message: string;
}

function findings(log: ApiLog): Finding[] {
  const out: Finding[] = [];

  if (log.bp) {
    const { sys, dia } = log.bp;
    if (sys >= 160 || dia >= 100) {
      out.push({ severity: 'high', message: `Blood pressure very high — ${sys}/${dia}.` });
    } else if (sys < 90 || dia < 60) {
      out.push({ severity: 'high', message: `Blood pressure very low — ${sys}/${dia}.` });
    } else if (sys >= 140 || dia >= 90) {
      out.push({ severity: 'medium', message: `Blood pressure elevated — ${sys}/${dia}.` });
    }
  }

  if (log.heartRate != null && (log.heartRate < 50 || log.heartRate > 110)) {
    out.push({
      severity: 'medium',
      message: `Heart rate out of range — ${log.heartRate} bpm.`,
    });
  }

  if (log.mood === 'rough') {
    out.push({ severity: 'low', message: 'Patient reported feeling rough today.' });
  }

  if (log.tookMeds === false) {
    out.push({ severity: 'low', message: 'Patient has not taken their medication yet.' });
  }

  return out;
}

/** Evaluates a check-in, persists any alerts, returns them.
 *  Idempotent per log — re-running replaces that day's alerts. */
export function runAlertRules(patientId: string, logId: string, log: ApiLog): ApiAlert[] {
  db.prepare('DELETE FROM alerts WHERE log_id = ?').run(logId);
  const found = findings(log);
  const insert = db.prepare(
    `INSERT INTO alerts (id, patient_id, log_id, severity, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  );
  const created: ApiAlert[] = [];
  for (const f of found) {
    const alertId = id('alt');
    insert.run(alertId, patientId, logId, f.severity, f.message, now());
    const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
    created.push(mapAlert(row));
  }
  return created;
}
