/* ============================================================
   Shared domain logic — check-ins, streaks, onboarding state.
   ============================================================ */

import { db, id, now, todayISO } from './db.js';
import { loadPatient, mapLog, type ApiLog } from './model.js';

export interface CheckInInput {
  mood?: 'great' | 'okay' | 'rough';
  tookMeds?: boolean;
  bp?: { sys: number; dia: number };
  heartRate?: number;
  source?: string;
}

/** Merges today's check-in into the patient's log and recomputes
 *  the sunrise streak. Returns the updated log row. */
export function recordCheckIn(patientId: string, input: CheckInInput): { log: ApiLog; logId: string } {
  const date = todayISO();
  const existing: any = db
    .prepare('SELECT * FROM daily_logs WHERE patient_id = ? AND date = ?')
    .get(patientId, date);

  const mood = input.mood ?? existing?.mood ?? null;
  const tookMeds =
    input.tookMeds != null ? (input.tookMeds ? 1 : 0) : (existing?.took_meds ?? null);
  const bpSys = input.bp?.sys ?? existing?.bp_sys ?? null;
  const bpDia = input.bp?.dia ?? existing?.bp_dia ?? null;
  const hr = input.heartRate ?? existing?.heart_rate ?? null;
  const source = input.source ?? existing?.source ?? 'manual';
  const complete = mood != null && tookMeds != null && bpSys != null ? 1 : 0;

  let logId: string;
  if (existing) {
    logId = existing.id;
    db.prepare(
      `UPDATE daily_logs SET mood=?, took_meds=?, bp_sys=?, bp_dia=?, heart_rate=?,
       complete=?, source=? WHERE id=?`,
    ).run(mood, tookMeds, bpSys, bpDia, hr, complete, source, logId);
  } else {
    logId = id('log');
    db.prepare(
      `INSERT INTO daily_logs (id, patient_id, date, mood, took_meds, bp_sys, bp_dia,
       heart_rate, complete, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(logId, patientId, date, mood, tookMeds, bpSys, bpDia, hr, complete, source, now());
  }

  recomputeStreak(patientId);
  const row = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(logId);
  return { log: mapLog(row), logId };
}

/**
 * Streak = consecutive completed days, counting back from today.
 * Today gets a grace period: if it isn't done yet the streak is
 * still whatever it was through yesterday, and only breaks once a
 * full day is missed.
 */
export function recomputeStreak(patientId: string): number {
  const logs: any[] = db
    .prepare('SELECT date, complete FROM daily_logs WHERE patient_id = ?')
    .all(patientId);
  const done = new Set(logs.filter((l) => l.complete).map((l) => l.date));

  const cursor = new Date();
  // If today isn't complete yet, start counting from yesterday.
  if (!done.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (;;) {
    const d = cursor.toISOString().slice(0, 10);
    if (done.has(d)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  db.prepare('UPDATE patients SET streak = ? WHERE id = ?').run(streak, patientId);
  return streak;
}

/** Resolves the patient's end state once eligibility is known. */
export function resolveState(patientId: string): string {
  const p: any = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const elig: any = db
    .prepare('SELECT * FROM eligibility WHERE patient_id = ? ORDER BY checked_at DESC LIMIT 1')
    .get(patientId);

  let state: string;
  if (elig && !elig.eligible) state = 'not-covered';
  else if (p.order_id) state = 'covered';
  else state = 'pending-order';

  db.prepare('UPDATE patients SET state = ? WHERE id = ?').run(state, patientId);
  return state;
}

export { loadPatient };
