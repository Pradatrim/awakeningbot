/* ============================================================
   Enrollment routes — both onboarding channels.

   Flow A (doctor referral): the provider places the order and we
   mint a pre-bound invite in one call.
   Flow B (ad → phone): the specialist creates the patient with a
   live eligibility result + verbal consent, no order yet.

   The pre-bound invite token is a capability: GET /invite/:token
   returns the bound record and POST .../complete mints the
   durable patient session.

   NOTE: provider/specialist/fulfill-order are staff actions; in
   production they sit behind staff auth. Left open for the demo.
   ============================================================ */

import { Router } from 'express';
import { db, id, now, token } from '../db.js';
import { loadPatient } from '../model.js';
import { issueToken } from '../auth.js';
import { resolveState } from '../logic.js';

export const enroll = Router();

interface PatientFields {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  mbi: string;
}

function validPatient(p: any): p is PatientFields {
  return (
    p && ['firstName', 'lastName', 'dob', 'phone', 'mbi'].every((k) => typeof p[k] === 'string')
  );
}

function createPatient(p: PatientFields, channel: string, state: string): string {
  const pid = id('pt');
  db.prepare(
    `INSERT INTO patients (id, state, channel, first_name, last_name, dob, phone, mbi,
     streak, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(pid, state, channel, p.firstName, p.lastName, p.dob, p.phone, p.mbi, now());
  return pid;
}

/* ---- Flow A: doctor referral ---- */
enroll.post('/provider', (req, res) => {
  const { patient, orderingProvider, diagnosis } = req.body ?? {};
  if (!validPatient(patient) || !orderingProvider || !diagnosis) {
    return res.status(400).json({ error: 'Missing patient, order provider or diagnosis.' });
  }
  const pid = createPatient(patient, 'flow-a-doctor', 'pending-order');
  const orderId = id('ord');
  db.prepare(
    `INSERT INTO orders (id, patient_id, source, ordering_provider, diagnosis, created_at)
     VALUES (?, ?, 'doctor-referral', ?, ?, ?)`,
  ).run(orderId, pid, orderingProvider, diagnosis, now());
  db.prepare('UPDATE patients SET order_id = ? WHERE id = ?').run(orderId, pid);

  const tok = token();
  db.prepare(
    `INSERT INTO invites (token, patient_id, order_id, channel, created_at)
     VALUES (?, ?, ?, 'flow-a-doctor', ?)`,
  ).run(tok, pid, orderId, now());

  res.json({ invite: { token: tok, channel: 'flow-a-doctor' }, patient: loadPatient(pid) });
});

/* ---- Flow B: ad → phone, assisted by a specialist ---- */
enroll.post('/specialist', (req, res) => {
  const { patient, eligibility, consent } = req.body ?? {};
  if (!validPatient(patient) || !eligibility || !consent) {
    return res.status(400).json({ error: 'Missing patient, eligibility or consent.' });
  }
  const state = eligibility.eligible ? 'pending-order' : 'not-covered';
  const pid = createPatient(patient, 'flow-b-ad', state);

  db.prepare(
    `INSERT INTO eligibility (id, patient_id, eligible, plan, monthly_cost, message, raw_271, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id('elg'),
    pid,
    eligibility.eligible ? 1 : 0,
    eligibility.plan,
    eligibility.monthlyCost ?? 0,
    eligibility.message ?? '',
    eligibility.raw271 ?? null,
    now(),
  );
  db.prepare(
    `INSERT INTO consents (id, patient_id, method, documented_by, given_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id('con'), pid, consent.method ?? 'verbal', consent.documentedBy ?? null, now());

  const tok = token();
  db.prepare(
    `INSERT INTO invites (token, patient_id, channel, created_at) VALUES (?, ?, 'flow-b-ad', ?)`,
  ).run(tok, pid, now());

  res.json({ invite: { token: tok, channel: 'flow-b-ad' }, patient: loadPatient(pid) });
});

/* ---- Flow B: the establishing visit produced the order ---- */
enroll.post('/fulfill-order', (req, res) => {
  const { patientId, source, orderingProvider, diagnosis } = req.body ?? {};
  const patient: any = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  if (patient.order_id) return res.status(409).json({ error: 'Order already on file.' });

  const orderId = id('ord');
  db.prepare(
    `INSERT INTO orders (id, patient_id, source, ordering_provider, diagnosis, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    orderId,
    patientId,
    source === 'doctor-referral' ? 'doctor-referral' : 'medisun-clinician',
    orderingProvider ?? 'Medisun-affiliated clinician',
    diagnosis ?? 'Chronic condition — RPM (established on visit)',
    now(),
  );
  db.prepare('UPDATE patients SET order_id = ? WHERE id = ?').run(orderId, patientId);
  resolveState(patientId);
  res.json({ patient: loadPatient(patientId) });
});

/* ---- pre-bound invite: read ---- */
enroll.get('/invite/:token', (req, res) => {
  const inv: any = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invite not found.' });
  res.json({
    invite: { token: inv.token, channel: inv.channel, consumedAt: inv.consumed_at },
    patient: loadPatient(inv.patient_id),
  });
});

/* ---- pre-bound invite: confirm pre-filled details ---- */
enroll.post('/invite/:token/confirm', (req, res) => {
  const inv: any = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invite not found.' });
  const f = req.body ?? {};
  if (!validPatient(f)) return res.status(400).json({ error: 'Incomplete patient details.' });

  db.prepare(
    `UPDATE patients SET first_name=?, last_name=?, dob=?, phone=?, mbi=? WHERE id=?`,
  ).run(f.firstName, f.lastName, f.dob, f.phone, f.mbi, inv.patient_id);
  res.json({ patient: loadPatient(inv.patient_id) });
});

/* ---- pre-bound invite: finish onboarding, mint the session ---- */
enroll.post('/invite/:token/complete', (req, res) => {
  const inv: any = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invite not found.' });
  const { eligibility, consent } = req.body ?? {};

  if (eligibility) {
    db.prepare(
      `INSERT INTO eligibility (id, patient_id, eligible, plan, monthly_cost, message, raw_271, checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id('elg'),
      inv.patient_id,
      eligibility.eligible ? 1 : 0,
      eligibility.plan,
      eligibility.monthlyCost ?? 0,
      eligibility.message ?? '',
      eligibility.raw271 ?? null,
      now(),
    );
  }
  if (consent) {
    db.prepare(
      `INSERT INTO consents (id, patient_id, method, documented_by, given_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id('con'), inv.patient_id, consent.method ?? 'e-consent', consent.documentedBy ?? null, now());
  }

  db.prepare('UPDATE patients SET enrolled_at = COALESCE(enrolled_at, ?) WHERE id = ?').run(
    now(),
    inv.patient_id,
  );
  const state = resolveState(inv.patient_id);
  db.prepare('UPDATE invites SET consumed_at = ? WHERE token = ?').run(now(), inv.token);

  const patient = loadPatient(inv.patient_id)!;
  const sessionToken = issueToken({
    scope: 'patient',
    sub: patient.id,
    name: patient.firstName,
  });
  res.json({ patient, state, sessionToken });
});
