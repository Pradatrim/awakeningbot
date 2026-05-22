/* ============================================================
   Seed data — a demo clinician and a demo enrolled elder so the
   app is explorable without walking onboarding first.
   ============================================================ */

import bcrypt from 'bcryptjs';
import { db, now } from './db.js';

export const DEMO_ELDER_ID = 'pt_demo_elder';
export const DEMO_CLINICIAN = { email: 'nurse@medisun.care', password: 'sunrise' };

export const DEMO_FLAGGED_ID = 'pt_demo_flagged';

export function ensureSeed(): void {
  seedClinician();
  seedElder();
  seedFlaggedPatient();
}

function seedClinician(): void {
  const exists = db
    .prepare('SELECT 1 FROM clinicians WHERE email = ?')
    .get(DEMO_CLINICIAN.email);
  if (exists) return;
  db.prepare(
    'INSERT INTO clinicians (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(
    'cl_demo',
    DEMO_CLINICIAN.email,
    bcrypt.hashSync(DEMO_CLINICIAN.password, 10),
    'Nurse Maria Alvarez, RN',
    now(),
  );
}

function seedElder(): void {
  const exists = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(DEMO_ELDER_ID);
  if (exists) return;

  const orderId = 'ord_demo_elder';
  // Patient first — orders.patient_id has a foreign key into patients.
  db.prepare(
    `INSERT INTO patients (id, state, channel, first_name, last_name, dob, phone, mbi,
     order_id, enrolled_at, streak, created_at)
     VALUES (?, 'covered', 'flow-a-doctor', 'Eleanor', 'Reyes', '1951-04-09',
     '(555) 204-8810', '1EG4-TE5-MK72', ?, ?, 0, ?)`,
  ).run(DEMO_ELDER_ID, orderId, now(), now());

  db.prepare(
    `INSERT INTO orders (id, patient_id, source, ordering_provider, diagnosis, created_at)
     VALUES (?, ?, 'doctor-referral', ?, ?, ?)`,
  ).run(
    orderId,
    DEMO_ELDER_ID,
    'Dr. Lopez — Sunrise Family Medicine',
    'Hypertension (I10)',
    now(),
  );

  db.prepare(
    `INSERT INTO eligibility (id, patient_id, eligible, plan, monthly_cost, message, checked_at)
     VALUES (?, ?, 1, 'Medicare Part B', 0, 'Great news — fully covered. $0 per month for you.', ?)`,
  ).run('elg_demo_elder', DEMO_ELDER_ID, now());

  db.prepare(
    `INSERT INTO consents (id, patient_id, method, given_at) VALUES (?, ?, 'e-consent', ?)`,
  ).run('con_demo_elder', DEMO_ELDER_ID, now());

  // Six prior completed days so the streak reads 6.
  const insertLog = db.prepare(
    `INSERT INTO daily_logs (id, patient_id, date, mood, took_meds, bp_sys, bp_dia,
     heart_rate, complete, source, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1, 'simulated', ?)`,
  );
  for (let i = 1; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    insertLog.run(
      `log_demo_${i}`,
      DEMO_ELDER_ID,
      date,
      i % 3 === 0 ? 'okay' : 'great',
      124 + (i % 4),
      78 + (i % 3),
      68 + (i % 6),
      now(),
    );
  }
  db.prepare('UPDATE patients SET streak = 6 WHERE id = ?').run(DEMO_ELDER_ID);
}

/** A second monitored patient with an elevated reading and an
 *  open alert — so the clinician dashboard has a real case. */
function seedFlaggedPatient(): void {
  if (db.prepare('SELECT 1 FROM patients WHERE id = ?').get(DEMO_FLAGGED_ID)) return;

  const orderId = 'ord_demo_flagged';
  db.prepare(
    `INSERT INTO patients (id, state, channel, first_name, last_name, dob, phone, mbi,
     order_id, enrolled_at, streak, created_at)
     VALUES (?, 'covered', 'flow-b-ad', 'Walter', 'Hughes', '1948-11-02',
     '(555) 661-2090', '7QW3-FN8-PA41', ?, ?, 3, ?)`,
  ).run(DEMO_FLAGGED_ID, orderId, now(), now());

  db.prepare(
    `INSERT INTO orders (id, patient_id, source, ordering_provider, diagnosis, created_at)
     VALUES (?, ?, 'medisun-clinician', 'Dr. Okafor — Medisun Clinic', 'Hypertension (I10)', ?)`,
  ).run(orderId, DEMO_FLAGGED_ID, now());

  db.prepare(
    `INSERT INTO eligibility (id, patient_id, eligible, plan, monthly_cost, message, checked_at)
     VALUES (?, ?, 1, 'Medicare Advantage Humana Gold', 8, 'Covered.', ?)`,
  ).run('elg_demo_flagged', DEMO_FLAGGED_ID, now());

  db.prepare(
    `INSERT INTO consents (id, patient_id, method, documented_by, given_at)
     VALUES (?, ?, 'verbal', 'M. Alvarez (enrollment specialist)', ?)`,
  ).run('con_demo_flagged', DEMO_FLAGGED_ID, now());

  const insertLog = db.prepare(
    `INSERT INTO daily_logs (id, patient_id, date, mood, took_meds, bp_sys, bp_dia,
     heart_rate, complete, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'bluetooth-cuff', ?)`,
  );
  // Three calm days, then a sharp rise on the most recent reading.
  const days = [
    { d: 4, sys: 132, dia: 84, mood: 'okay', meds: 1 },
    { d: 3, sys: 138, dia: 88, mood: 'okay', meds: 1 },
    { d: 2, sys: 146, dia: 92, mood: 'rough', meds: 0 },
    { d: 1, sys: 168, dia: 103, mood: 'rough', meds: 1 },
  ];
  for (const x of days) {
    const dt = new Date();
    dt.setDate(dt.getDate() - x.d);
    insertLog.run(
      `log_flag_${x.d}`,
      DEMO_FLAGGED_ID,
      dt.toISOString().slice(0, 10),
      x.mood,
      x.meds,
      x.sys,
      x.dia,
      70 + x.d,
      now(),
    );
  }

  // The open alert the care team needs to triage.
  db.prepare(
    `INSERT INTO alerts (id, patient_id, log_id, severity, message, status, created_at)
     VALUES (?, ?, 'log_flag_1', 'high', 'Blood pressure very high — 168/103.', 'open', ?)`,
  ).run('alt_demo_flagged', DEMO_FLAGGED_ID, now());
}
