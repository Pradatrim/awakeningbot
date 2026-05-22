/* ============================================================
   Billing routes — RPM claims & clinical time.

   Clinician-scoped. The billing engine decides what is billable;
   these endpoints log clinical time, generate 837P claims, and
   move claims through submit → remittance.

   Compliance: a claim can only be generated for a `covered`
   patient with an RPM order, and only for CPT codes the engine
   marks billable for the period.
   ============================================================ */

import { Router } from 'express';
import { db, id, now, todayISO } from '../db.js';
import { requireScope } from '../auth.js';
import { loadClaim, loadPatient, mapTimeLog } from '../model.js';
import { assessBilling } from '../billing/engine.js';
import { build837P } from '../billing/x12_837.js';
import { PAYER_COINSURANCE, currentPeriod, money } from '../billing/cpt.js';

export const billing = Router();
billing.use(requireScope('clinician'));

function controlNumber(): string {
  return String(Date.now()).slice(-9);
}

/** Billing assessment — what is billable for a patient/period. */
billing.get('/assessment/:patientId', (req, res) => {
  const period = (req.query.period as string) || currentPeriod();
  res.json({ assessment: assessBilling(req.params.patientId, period) });
});

/** Log clinical time toward the 99457 / 99458 management codes. */
billing.post('/time', (req, res) => {
  const { patientId, minutes, note, serviceDate } = req.body ?? {};
  const mins = Number(minutes);
  if (!patientId || !Number.isFinite(mins) || mins <= 0 || mins > 240) {
    return res.status(400).json({ error: 'Enter clinical minutes between 1 and 240.' });
  }
  if (!loadPatient(patientId)) return res.status(404).json({ error: 'Patient not found.' });

  const logId = id('tim');
  db.prepare(
    `INSERT INTO clinical_time (id, patient_id, clinician_id, clinician_name, minutes, note,
     service_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    logId,
    patientId,
    req.principal!.sub,
    req.principal!.name ?? null,
    Math.round(mins),
    note ?? null,
    serviceDate || todayISO(),
    now(),
  );

  const row = db.prepare('SELECT * FROM clinical_time WHERE id = ?').get(logId);
  res.json({ timeLog: mapTimeLog(row), assessment: assessBilling(patientId, currentPeriod()) });
});

/** Clinical-time history for a patient. */
billing.get('/time/:patientId', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM clinical_time WHERE patient_id = ? ORDER BY service_date DESC')
    .all(req.params.patientId);
  res.json({ timeLogs: rows.map(mapTimeLog) });
});

/** Generate a draft claim from the billing assessment. */
billing.post('/claims', (req, res) => {
  const { patientId, period } = req.body ?? {};
  const p = period || currentPeriod();
  const patient = loadPatient(patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });

  const assessment = assessBilling(patientId, p);
  if (!assessment.eligibleToBill) {
    return res.status(409).json({ error: assessment.blockReason });
  }
  const billable = assessment.codes.filter((c) => c.billable && c.units > 0);
  if (billable.length === 0) {
    return res.status(409).json({ error: 'Nothing is billable for this patient this period.' });
  }
  const existing = db
    .prepare("SELECT id FROM claims WHERE patient_id = ? AND period = ? AND status != 'denied'")
    .get(patientId, p) as any;
  if (existing) {
    return res
      .status(409)
      .json({ error: 'A claim already exists for this patient and period.', claimId: existing.id });
  }

  const claimId = id('clm');
  const ctrl = controlNumber();
  const total = money(billable.reduce((s, c) => s + c.charge, 0));

  db.prepare(
    `INSERT INTO claims (id, patient_id, period, status, payer, diagnosis_code,
     total_charge, control_number, created_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
  ).run(claimId, patientId, p, assessment.payer, assessment.dxCode, total, ctrl, now());

  const insertLine = db.prepare(
    `INSERT INTO claim_lines (id, claim_id, cpt, description, units, rate, charge,
     dx_code, service_from, service_to, supporting)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of billable) {
    insertLine.run(
      id('cln'),
      claimId,
      c.code,
      c.label,
      c.units,
      c.rate,
      c.charge,
      assessment.dxCode,
      assessment.periodFrom,
      assessment.periodTo,
      c.reason,
    );
  }

  // Build the 837P now so the claim detail can show the EDI.
  const x12 = build837P(
    {
      claimId,
      controlNumber: ctrl,
      payer: assessment.payer,
      dxCode: assessment.dxCode,
      totalCharge: total,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
        mbi: patient.mbi,
      },
      renderingProvider: patient.order?.orderingProvider ?? 'Medisun Care',
    },
    billable.map((c) => ({
      cpt: c.code,
      charge: c.charge,
      units: c.units,
      serviceFrom: assessment.periodFrom,
      serviceTo: assessment.periodTo,
    })),
  );
  db.prepare('UPDATE claims SET x12_837 = ? WHERE id = ?').run(x12, claimId);

  res.json({ claim: loadClaim(claimId) });
});

/** All claims, newest first. */
billing.get('/claims', (req, res) => {
  const period = req.query.period as string | undefined;
  const rows = period
    ? db.prepare('SELECT id FROM claims WHERE period = ? ORDER BY created_at DESC').all(period)
    : db.prepare('SELECT id FROM claims ORDER BY created_at DESC').all();
  res.json({ claims: rows.map((r: any) => loadClaim(r.id)) });
});

billing.get('/claims/:id', (req, res) => {
  const claim = loadClaim(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  res.json({ claim });
});

/** Submit a draft claim to the payer (clearinghouse). */
billing.post('/claims/:id/submit', (req, res) => {
  const claim = loadClaim(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  if (claim.status !== 'draft') {
    return res.status(409).json({ error: `Claim is already ${claim.status}.` });
  }
  db.prepare("UPDATE claims SET status = 'submitted', submitted_at = ? WHERE id = ?").run(
    now(),
    claim.id,
  );
  res.json({ claim: loadClaim(claim.id) });
});

/**
 * Post a remittance against a submitted claim. Mocks the 835
 * remittance advice: Medicare Part B pays 80%, the remaining 20%
 * is patient responsibility. `outcome: 'denied'` records a denial.
 */
billing.post('/claims/:id/remit', (req, res) => {
  const claim = loadClaim(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  if (claim.status !== 'submitted') {
    return res.status(409).json({ error: 'Only a submitted claim can be remitted.' });
  }
  const { outcome, denialReason } = req.body ?? {};
  if (outcome === 'denied') {
    db.prepare("UPDATE claims SET status = 'denied', denial_reason = ?, paid_at = ? WHERE id = ?").run(
      denialReason || 'Claim denied by payer.',
      now(),
      claim.id,
    );
  } else {
    const payerPaid = money(claim.totalCharge * PAYER_COINSURANCE);
    const patientResp = money(claim.totalCharge - payerPaid);
    db.prepare(
      `UPDATE claims SET status = 'paid', payer_paid = ?, patient_responsibility = ?, paid_at = ?
       WHERE id = ?`,
    ).run(payerPaid, patientResp, now(), claim.id);
  }
  res.json({ claim: loadClaim(claim.id) });
});
