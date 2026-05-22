/* ============================================================
   Billing engine.

   Given a patient and a billing period, decides which RPM CPT
   codes are billable and why — applying the Medicare coverage
   rules. This is a pure assessment: it reads the record but
   writes nothing. Claim creation consumes the result.
   ============================================================ */

import { db } from '../db.js';
import { loadPatient } from '../model.js';
import {
  CPT,
  MAX_99458_UNITS,
  MIN_MINUTES_99457,
  MIN_READING_DAYS,
  currentPeriod,
  extractIcd10,
  money,
  periodBounds,
} from './cpt.js';

export interface CptAssessment {
  code: string;
  label: string;
  rule: string;
  rate: number;
  billable: boolean;
  units: number;
  charge: number;
  /** Why this code is or isn't billable this period. */
  reason: string;
}

export interface BillingAssessment {
  patientId: string;
  patientName: string;
  period: string;
  periodFrom: string;
  periodTo: string;
  /** Compliance gate — a claim can only be generated when true. */
  eligibleToBill: boolean;
  blockReason?: string;
  readingDays: number;
  clinicalMinutes: number;
  priorSetupBilled: boolean;
  diagnosis: string;
  dxCode: string;
  payer: string;
  codes: CptAssessment[];
  billableTotal: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function assessBilling(patientId: string, period = currentPeriod()): BillingAssessment {
  const patient = loadPatient(patientId);
  const { from, to } = periodBounds(period);

  const base = {
    patientId,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
    period,
    periodFrom: from,
    periodTo: to,
  };

  if (!patient) {
    return blocked(base, 'Patient not found.', 'I10', 'Medicare', 0, 0, false, '—');
  }

  const diagnosis = patient.order?.diagnosis ?? '—';
  const dxCode = extractIcd10(diagnosis);
  const payer = patient.eligibility?.plan ?? 'Medicare';

  // Reading days and clinical minutes within the period.
  const readingDays = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT date) AS n FROM daily_logs
         WHERE patient_id = ? AND bp_sys IS NOT NULL AND date BETWEEN ? AND ?`,
      )
      .get(patientId, from, to) as any
  ).n as number;

  const clinicalMinutes = (
    db
      .prepare(
        `SELECT COALESCE(SUM(minutes), 0) AS m FROM clinical_time
         WHERE patient_id = ? AND service_date BETWEEN ? AND ?`,
      )
      .get(patientId, from, to) as any
  ).m as number;

  // 99453 is once per episode of care — has it been billed before?
  const priorSetupBilled =
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM claim_lines cl
           JOIN claims c ON c.id = cl.claim_id
           WHERE c.patient_id = ? AND cl.cpt = '99453' AND c.status != 'denied'`,
        )
        .get(patientId) as any
    ).n > 0;

  // Compliance gate.
  const eligibleToBill = patient.state === 'covered' && !!patient.order;
  const blockReason = eligibleToBill
    ? undefined
    : 'No claim can be generated until the patient is covered with an RPM order on file.';

  const codes: CptAssessment[] = [
    line('99453', eligibleToBill && readingDays >= 1 && !priorSetupBilled, 1, () => {
      if (!eligibleToBill) return 'Patient is not yet covered with an order.';
      if (priorSetupBilled) return 'Already billed — setup is once per episode of care.';
      if (readingDays < 1) return 'No device readings captured yet.';
      return 'First reading captured — setup is billable.';
    }),
    line('99454', eligibleToBill && readingDays >= MIN_READING_DAYS, 1, () => {
      if (!eligibleToBill) return 'Patient is not yet covered with an order.';
      return readingDays >= MIN_READING_DAYS
        ? `${readingDays} reading days captured (16+ required).`
        : `${readingDays} of ${MIN_READING_DAYS} reading days so far this period.`;
    }),
    line('99457', eligibleToBill && clinicalMinutes >= MIN_MINUTES_99457, 1, () => {
      if (!eligibleToBill) return 'Patient is not yet covered with an order.';
      return clinicalMinutes >= MIN_MINUTES_99457
        ? `${clinicalMinutes} minutes of clinical time logged (20+ required).`
        : `${clinicalMinutes} of ${MIN_MINUTES_99457} minutes logged this period.`;
    }),
    addOn99458(eligibleToBill, clinicalMinutes),
  ];

  const billableTotal = money(
    codes.filter((c) => c.billable).reduce((s, c) => s + c.charge, 0),
  );

  return {
    ...base,
    eligibleToBill,
    blockReason,
    readingDays,
    clinicalMinutes,
    priorSetupBilled,
    diagnosis,
    dxCode,
    payer,
    codes,
    billableTotal,
  };
}

function line(code: string, billable: boolean, units: number, reason: () => string): CptAssessment {
  const def = CPT[code];
  return {
    code,
    label: def.label,
    rule: def.rule,
    rate: def.rate,
    billable,
    units: billable ? units : 0,
    charge: billable ? money(def.rate * units) : 0,
    reason: reason(),
  };
}

function addOn99458(eligible: boolean, minutes: number): CptAssessment {
  const def = CPT['99458'];
  let units = 0;
  if (eligible && minutes >= MIN_MINUTES_99457 + 20) {
    units = clamp(Math.floor((minutes - MIN_MINUTES_99457) / 20), 0, MAX_99458_UNITS);
  }
  const billable = units > 0;
  const reason = !eligible
    ? 'Patient is not yet covered with an order.'
    : billable
      ? `${minutes} minutes supports ${units} additional 20-minute unit${units === 1 ? '' : 's'}.`
      : `Needs 40+ minutes for an add-on unit (${minutes} logged).`;
  return {
    code: '99458',
    label: def.label,
    rule: def.rule,
    rate: def.rate,
    billable,
    units,
    charge: billable ? money(def.rate * units) : 0,
    reason,
  };
}

function blocked(
  base: any,
  reason: string,
  dxCode: string,
  payer: string,
  readingDays: number,
  clinicalMinutes: number,
  priorSetupBilled: boolean,
  diagnosis: string,
): BillingAssessment {
  return {
    ...base,
    eligibleToBill: false,
    blockReason: reason,
    readingDays,
    clinicalMinutes,
    priorSetupBilled,
    diagnosis,
    dxCode,
    payer,
    codes: [],
    billableTotal: 0,
  };
}
