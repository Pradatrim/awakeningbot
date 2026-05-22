/* ============================================================
   Row → API object mappers.

   The DB uses snake_case columns; the API speaks camelCase. These
   helpers assemble the full patient object the client consumes.
   ============================================================ */

import { db } from './db.js';

export interface ApiOrder {
  id: string;
  source: string;
  orderingProvider: string;
  diagnosis: string;
  createdAt: string;
}

export interface ApiEligibility {
  eligible: boolean;
  plan: string;
  monthlyCost: number;
  message: string;
  checkedAt: string;
}

export interface ApiConsent {
  method: 'e-consent' | 'verbal';
  documentedBy?: string;
  givenAt: string;
}

export interface ApiLog {
  date: string;
  mood?: 'great' | 'okay' | 'rough';
  tookMeds?: boolean;
  bp?: { sys: number; dia: number };
  heartRate?: number;
  complete: boolean;
  source?: string;
}

export interface ApiAlert {
  id: string;
  patientId: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface ApiPatient {
  id: string;
  state: string;
  channel: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  mbi: string;
  orderId?: string;
  enrolledAt?: string;
  streak: number;
  order?: ApiOrder;
  eligibility?: ApiEligibility;
  consent?: ApiConsent;
  logs: ApiLog[];
}

export function mapOrder(r: any): ApiOrder {
  return {
    id: r.id,
    source: r.source,
    orderingProvider: r.ordering_provider,
    diagnosis: r.diagnosis,
    createdAt: r.created_at,
  };
}

export function mapEligibility(r: any): ApiEligibility {
  return {
    eligible: !!r.eligible,
    plan: r.plan,
    monthlyCost: r.monthly_cost,
    message: r.message,
    checkedAt: r.checked_at,
  };
}

export function mapConsent(r: any): ApiConsent {
  return { method: r.method, documentedBy: r.documented_by ?? undefined, givenAt: r.given_at };
}

export function mapLog(r: any): ApiLog {
  return {
    date: r.date,
    mood: r.mood ?? undefined,
    tookMeds: r.took_meds === null ? undefined : !!r.took_meds,
    bp: r.bp_sys != null ? { sys: r.bp_sys, dia: r.bp_dia } : undefined,
    heartRate: r.heart_rate ?? undefined,
    complete: !!r.complete,
    source: r.source ?? undefined,
  };
}

export function mapAlert(r: any): ApiAlert {
  return {
    id: r.id,
    patientId: r.patient_id,
    severity: r.severity,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? undefined,
  };
}

/** Assembles the full patient object from every related table. */
export function loadPatient(patientId: string): ApiPatient | undefined {
  const p: any = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!p) return undefined;

  const order = p.order_id
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(p.order_id)
    : undefined;
  const elig = db
    .prepare('SELECT * FROM eligibility WHERE patient_id = ? ORDER BY checked_at DESC LIMIT 1')
    .get(patientId);
  const consent = db
    .prepare('SELECT * FROM consents WHERE patient_id = ? ORDER BY given_at DESC LIMIT 1')
    .get(patientId);
  const logs = db
    .prepare('SELECT * FROM daily_logs WHERE patient_id = ? ORDER BY date DESC')
    .all(patientId);

  return {
    id: p.id,
    state: p.state,
    channel: p.channel,
    firstName: p.first_name,
    lastName: p.last_name,
    dob: p.dob,
    phone: p.phone,
    mbi: p.mbi,
    orderId: p.order_id ?? undefined,
    enrolledAt: p.enrolled_at ?? undefined,
    streak: p.streak,
    order: order ? mapOrder(order) : undefined,
    eligibility: elig ? mapEligibility(elig) : undefined,
    consent: consent ? mapConsent(consent) : undefined,
    logs: logs.map(mapLog),
  };
}
