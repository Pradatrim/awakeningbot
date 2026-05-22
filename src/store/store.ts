/* ============================================================
   Medisun Care — app store

   A tiny observable store persisted to localStorage. The provider
   screen, specialist screen and patient app all read/write the
   same store, so a QR/invite created on one screen can be opened
   on another — exactly how the real pre-bound invite works.
   ============================================================ */

import { useSyncExternalStore } from 'react';
import type {
  AppState,
  Consent,
  DailyLog,
  EligibilityResult,
  EnrollChannel,
  Invite,
  OrderSource,
  Patient,
  PatientState,
  RpmOrder,
} from './types';

const KEY = 'medisun.state.v1';

const EMPTY: AppState = { patients: {}, orders: {}, invites: {} };

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt state */
  }
  return EMPTY;
}

let state: AppState = load();
const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — fine for a prototype */
  }
  listeners.forEach((l) => l());
}

/* ---- ids ---- */
let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}`;
}
function token(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
   Reads
   ============================================================ */

export function getState(): AppState {
  return state;
}

export function getPatient(patientId?: string): Patient | undefined {
  return patientId ? state.patients[patientId] : undefined;
}

export function getInvite(tok: string): Invite | undefined {
  return state.invites[tok];
}

export function getOrder(orderId?: string): RpmOrder | undefined {
  return orderId ? state.orders[orderId] : undefined;
}

export function currentPatient(): Patient | undefined {
  return getPatient(state.currentPatientId);
}

/* ============================================================
   Enrollment — Flow A (doctor referral, self-serve in office)
   ============================================================ */

export interface NewPatientFields {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  mbi: string;
}

/**
 * The doctor places the RPM order in the room. We create the
 * patient, the order, and a pre-bound invite in one action. The
 * patient starts `pending-order` and flips to `covered` the
 * moment they finish e-consent in the app.
 */
export function enrollFromProvider(args: {
  patient: NewPatientFields;
  orderingProvider: string;
  diagnosis: string;
}): Invite {
  const patientId = id('pt');
  const orderId = id('ord');

  const order: RpmOrder = {
    id: orderId,
    patientId,
    source: 'doctor-referral',
    orderingProvider: args.orderingProvider,
    diagnosis: args.diagnosis,
    createdAt: new Date().toISOString(),
  };

  const patient: Patient = {
    id: patientId,
    state: 'pending-order',
    channel: 'flow-a-doctor',
    ...args.patient,
    orderId,
    logs: [],
    streak: 0,
  };

  const invite: Invite = {
    token: token(),
    patientId,
    orderId,
    channel: 'flow-a-doctor',
    createdAt: new Date().toISOString(),
  };

  commit({
    ...state,
    patients: { ...state.patients, [patientId]: patient },
    orders: { ...state.orders, [orderId]: order },
    invites: { ...state.invites, [invite.token]: invite },
  });
  return invite;
}

/* ============================================================
   Enrollment — Flow B (ad → phone → assisted by a specialist)
   ============================================================ */

/**
 * The specialist runs intake + the live eligibility check on the
 * call, then generates a pre-bound link. No order exists yet, so
 * the patient is `pending-order` (or `not-covered` if the check
 * failed → routed to the free self-tracking tier).
 */
export function enrollFromSpecialist(args: {
  patient: NewPatientFields;
  eligibility: EligibilityResult;
  consent: Consent;
}): Invite {
  const patientId = id('pt');
  const eligible = args.eligibility.eligible;

  const patient: Patient = {
    id: patientId,
    state: eligible ? 'pending-order' : 'not-covered',
    channel: 'flow-b-ad',
    ...args.patient,
    eligibility: args.eligibility,
    consent: args.consent,
    logs: [],
    streak: 0,
  };

  const invite: Invite = {
    token: token(),
    patientId,
    channel: 'flow-b-ad',
    createdAt: new Date().toISOString(),
  };

  commit({
    ...state,
    patients: { ...state.patients, [patientId]: patient },
    invites: { ...state.invites, [invite.token]: invite },
  });
  return invite;
}

/**
 * The establishing visit produced the order. This is the only
 * path that turns on Medicare billing for a Flow B patient.
 */
export function fulfillOrder(args: {
  patientId: string;
  source: OrderSource;
  orderingProvider: string;
  diagnosis: string;
}): void {
  const patient = state.patients[args.patientId];
  if (!patient) return;
  const orderId = id('ord');
  const order: RpmOrder = {
    id: orderId,
    patientId: args.patientId,
    source: args.source,
    orderingProvider: args.orderingProvider,
    diagnosis: args.diagnosis,
    createdAt: new Date().toISOString(),
  };
  commit({
    ...state,
    orders: { ...state.orders, [orderId]: order },
    patients: {
      ...state.patients,
      [args.patientId]: { ...patient, orderId, state: 'covered' },
    },
  });
}

/* ============================================================
   Patient app
   ============================================================ */

export function patchPatient(patientId: string, patch: Partial<Patient>): void {
  const patient = state.patients[patientId];
  if (!patient) return;
  commit({
    ...state,
    patients: { ...state.patients, [patientId]: { ...patient, ...patch } },
  });
}

/** Records eligibility + consent and lands the patient in the
 *  correct end state. Called when in-app onboarding finishes. */
export function finishOnboarding(args: {
  patientId: string;
  eligibility: EligibilityResult;
  consent: Consent;
}): PatientState {
  const patient = state.patients[args.patientId];
  if (!patient) return 'free';

  let next: PatientState;
  if (!args.eligibility.eligible) next = 'not-covered';
  else if (patient.orderId) next = 'covered'; // Flow A — order already on file
  else next = 'pending-order'; // Flow B — order still being produced

  commit({
    ...state,
    currentPatientId: args.patientId,
    patients: {
      ...state.patients,
      [args.patientId]: {
        ...patient,
        eligibility: args.eligibility,
        consent: args.consent,
        state: next,
        enrolledAt: patient.enrolledAt ?? new Date().toISOString(),
      },
    },
  });
  return next;
}

export function signIn(patientId: string): void {
  if (!state.patients[patientId]) return;
  commit({ ...state, currentPatientId: patientId });
}

export function signOut(): void {
  commit({ ...state, currentPatientId: undefined });
}

/* ---- daily engagement ritual ---- */

/** Merges today's check-in progress into the patient's log and
 *  updates the sunrise streak when the day is completed. */
export function recordCheckIn(patientId: string, entry: Partial<DailyLog>): void {
  const patient = state.patients[patientId];
  if (!patient) return;

  const date = today();
  const existing = patient.logs.find((l) => l.date === date);
  const merged: DailyLog = {
    date,
    ...existing,
    ...entry,
    complete: false,
  };
  merged.complete =
    merged.mood !== undefined && merged.tookMeds !== undefined && merged.bp !== undefined;

  const others = patient.logs.filter((l) => l.date !== date);
  const logs = [merged, ...others];

  // Streak = consecutive completed days ending today.
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const d = cursor.toISOString().slice(0, 10);
    const log = logs.find((l) => l.date === d);
    if (log && log.complete) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  commit({
    ...state,
    patients: { ...state.patients, [patientId]: { ...patient, logs, streak } },
  });
}

/* ---- demo helpers ---- */

/** Seeds a fully-enrolled elder with a 6-day streak so the daily
 *  app can be viewed directly, without walking onboarding. */
export function seedDemoElder(): string {
  const existing = Object.values(state.patients).find((p) => p.id === 'pt_demo');
  if (existing) {
    commit({ ...state, currentPatientId: existing.id });
    return existing.id;
  }

  const logs: DailyLog[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    logs.push({
      date: d.toISOString().slice(0, 10),
      mood: i % 3 === 0 ? 'okay' : 'great',
      tookMeds: true,
      bp: { sys: 124 + (i % 4), dia: 78 + (i % 3) },
      heartRate: 68 + (i % 6),
      complete: true,
    });
  }

  const order: RpmOrder = {
    id: 'ord_demo',
    patientId: 'pt_demo',
    source: 'doctor-referral',
    orderingProvider: 'Dr. Lopez — Sunrise Family Medicine',
    diagnosis: 'Hypertension (I10)',
    createdAt: new Date().toISOString(),
  };

  const patient: Patient = {
    id: 'pt_demo',
    state: 'covered',
    channel: 'flow-a-doctor',
    firstName: 'Eleanor',
    lastName: 'Reyes',
    dob: '1951-04-09',
    phone: '(555) 204-8810',
    mbi: '1EG4-TE5-MK72',
    orderId: 'ord_demo',
    eligibility: {
      checkedAt: new Date().toISOString(),
      eligible: true,
      plan: 'Medicare Part B',
      monthlyCost: 0,
      message: 'Great news — fully covered. $0 per month for you.',
    },
    consent: { givenAt: new Date().toISOString(), method: 'e-consent' },
    enrolledAt: new Date().toISOString(),
    logs,
    streak: 6,
  };

  commit({
    ...state,
    patients: { ...state.patients, [patient.id]: patient },
    orders: { ...state.orders, [order.id]: order },
    currentPatientId: patient.id,
  });
  return patient.id;
}

export function resetAll(): void {
  commit({ ...EMPTY });
}

/* ============================================================
   React binding
   ============================================================ */

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export type { EnrollChannel };
