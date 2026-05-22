/* ============================================================
   Medisun Care — API client.

   Thin fetch wrapper over the backend. Holds the two session
   tokens (patient + clinician) in localStorage so a signed-in
   session survives reloads and works across devices.
   ============================================================ */

import type {
  Alert,
  BillingAssessment,
  Claim,
  Consent,
  DailyLog,
  Eligibility,
  Invite,
  PanelPatient,
  Patient,
  TimeLog,
} from './store/types';

const PATIENT_KEY = 'medisun.session';
const CLINICIAN_KEY = 'medisun.clinician';

export function getPatientToken(): string | null {
  return localStorage.getItem(PATIENT_KEY);
}
export function setPatientToken(t: string | null): void {
  if (t) localStorage.setItem(PATIENT_KEY, t);
  else localStorage.removeItem(PATIENT_KEY);
}
export function getClinicianToken(): string | null {
  return localStorage.getItem(CLINICIAN_KEY);
}
export function setClinicianToken(t: string | null): void {
  if (t) localStorage.setItem(CLINICIAN_KEY, t);
  else localStorage.removeItem(CLINICIAN_KEY);
}

type Auth = 'patient' | 'clinician' | 'none';

async function call<T>(
  method: string,
  path: string,
  opts: { body?: unknown; auth?: Auth } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';

  const auth = opts.auth ?? 'none';
  if (auth === 'patient') {
    const t = getPatientToken();
    if (t) headers['authorization'] = `Bearer ${t}`;
  } else if (auth === 'clinician') {
    const t = getClinicianToken();
    if (t) headers['authorization'] = `Bearer ${t}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

/* ---- enrollment ---- */

interface PatientFields {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  mbi: string;
}

export const api = {
  /* eligibility */
  checkEligibility(input: { mbi: string; firstName?: string; lastName?: string; dob?: string }) {
    return call<{ eligibility: Eligibility }>('POST', '/eligibility/check', { body: input }).then(
      (r) => r.eligibility,
    );
  },

  /* Flow A — doctor referral */
  enrollProvider(input: { patient: PatientFields; orderingProvider: string; diagnosis: string }) {
    return call<{ invite: Invite; patient: Patient }>('POST', '/enroll/provider', {
      body: input,
    });
  },

  /* Flow B — specialist */
  enrollSpecialist(input: { patient: PatientFields; eligibility: Eligibility; consent: Consent }) {
    return call<{ invite: Invite; patient: Patient }>('POST', '/enroll/specialist', {
      body: input,
    });
  },
  fulfillOrder(input: {
    patientId: string;
    source: string;
    orderingProvider?: string;
    diagnosis?: string;
  }) {
    return call<{ patient: Patient }>('POST', '/enroll/fulfill-order', { body: input });
  },

  /* pre-bound invite */
  getInvite(token: string) {
    return call<{ invite: Invite; patient: Patient }>('GET', `/enroll/invite/${token}`);
  },
  confirmInvite(token: string, fields: PatientFields) {
    return call<{ patient: Patient }>('POST', `/enroll/invite/${token}/confirm`, { body: fields });
  },
  completeInvite(token: string, input: { eligibility?: Eligibility; consent: Consent }) {
    return call<{ patient: Patient; state: string; sessionToken: string }>(
      'POST',
      `/enroll/invite/${token}/complete`,
      { body: input },
    );
  },

  /* patient app */
  demoLogin() {
    return call<{ patient: Patient; sessionToken: string }>('POST', '/dev/demo-login');
  },
  me() {
    return call<{ patient: Patient }>('GET', '/patient/me', { auth: 'patient' }).then(
      (r) => r.patient,
    );
  },
  checkIn(input: {
    mood?: string;
    tookMeds?: boolean;
    bp?: { sys: number; dia: number };
    heartRate?: number;
    source?: string;
  }) {
    return call<{ patient: Patient; log: DailyLog; alerts: Alert[] }>('POST', '/patient/checkin', {
      body: input,
      auth: 'patient',
    });
  },

  /* clinician */
  clinicianLogin(email: string, password: string) {
    return call<{ token: string; clinician: { id: string; name: string; email: string } }>(
      'POST',
      '/clinician/login',
      { body: { email, password } },
    );
  },
  panel() {
    return call<{ patients: PanelPatient[] }>('GET', '/clinician/panel', { auth: 'clinician' }).then(
      (r) => r.patients,
    );
  },
  clinicianPatient(id: string) {
    return call<{ patient: Patient; alerts: Alert[] }>('GET', `/clinician/patient/${id}`, {
      auth: 'clinician',
    });
  },
  resolveAlert(id: string) {
    return call<{ alert: Alert }>('POST', `/clinician/alert/${id}/resolve`, { auth: 'clinician' });
  },
  requestCall(patientId: string) {
    return call<{ alert: Alert }>('POST', `/clinician/patient/${patientId}/request-call`, {
      auth: 'clinician',
    });
  },

  /* billing */
  billingAssessment(patientId: string, period?: string) {
    const q = period ? `?period=${period}` : '';
    return call<{ assessment: BillingAssessment }>(
      'GET',
      `/billing/assessment/${patientId}${q}`,
      { auth: 'clinician' },
    ).then((r) => r.assessment);
  },
  logTime(input: { patientId: string; minutes: number; note?: string }) {
    return call<{ timeLog: TimeLog; assessment: BillingAssessment }>('POST', '/billing/time', {
      body: input,
      auth: 'clinician',
    });
  },
  timeLogs(patientId: string) {
    return call<{ timeLogs: TimeLog[] }>('GET', `/billing/time/${patientId}`, {
      auth: 'clinician',
    }).then((r) => r.timeLogs);
  },
  generateClaim(input: { patientId: string; period?: string }) {
    return call<{ claim: Claim }>('POST', '/billing/claims', { body: input, auth: 'clinician' });
  },
  claims(period?: string) {
    const q = period ? `?period=${period}` : '';
    return call<{ claims: Claim[] }>('GET', `/billing/claims${q}`, { auth: 'clinician' }).then(
      (r) => r.claims,
    );
  },
  claim(id: string) {
    return call<{ claim: Claim }>('GET', `/billing/claims/${id}`, { auth: 'clinician' }).then(
      (r) => r.claim,
    );
  },
  submitClaim(id: string) {
    return call<{ claim: Claim }>('POST', `/billing/claims/${id}/submit`, { auth: 'clinician' }).then(
      (r) => r.claim,
    );
  },
  remitClaim(id: string, outcome?: 'paid' | 'denied') {
    return call<{ claim: Claim }>('POST', `/billing/claims/${id}/remit`, {
      body: { outcome },
      auth: 'clinician',
    }).then((r) => r.claim);
  },
};
