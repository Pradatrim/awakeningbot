/* ============================================================
   Medisun Care — domain model
   ============================================================ */

/**
 * The compliance guardrail. Every patient moves through these
 * states. Medicare is ONLY billed while `covered` — billing can
 * never fire without a physician order behind it.
 *
 *   free          → using the app, self-tracking, nothing billed
 *   pending-order → enrolled, waiting on the physician order
 *   covered       → order on file, RPM billing active
 *   not-covered   → eligibility failed → routed to free tier
 */
export type PatientState = 'free' | 'pending-order' | 'covered' | 'not-covered';

/** Who supplied the physician order. */
export type OrderSource = 'doctor-referral' | 'medisun-clinician';

/** Which onboarding channel the patient came through. */
export type EnrollChannel = 'flow-a-doctor' | 'flow-b-ad';

export interface RpmOrder {
  id: string;
  patientId: string;
  source: OrderSource;
  /** Practice / clinician that placed the order. */
  orderingProvider: string;
  /** Documented reason — establishes medical necessity. */
  diagnosis: string;
  createdAt: string;
}

export interface EligibilityResult {
  checkedAt: string;
  eligible: boolean;
  /** Plan name shown back to the patient. */
  plan: string;
  /** Patient monthly out-of-pocket in dollars (0 = fully covered). */
  monthlyCost: number;
  message: string;
}

export interface Consent {
  givenAt: string;
  /** e-consent in-app, or verbal consent captured by a specialist. */
  method: 'e-consent' | 'verbal';
  /** For verbal consent: the specialist who documented it. */
  documentedBy?: string;
}

/** One day of the patient's engagement ritual. */
export interface DailyLog {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  mood?: 'great' | 'okay' | 'rough';
  tookMeds?: boolean;
  /** Systolic / diastolic, mock readings. */
  bp?: { sys: number; dia: number };
  heartRate?: number;
  /** True once all three morning steps are done. */
  complete: boolean;
}

export interface Patient {
  id: string;
  state: PatientState;
  channel: EnrollChannel;
  /** Chart data — pre-filled from the practice (Flow A) or
   *  taken by the specialist on the call (Flow B). */
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  /** Medicare Beneficiary Identifier. */
  mbi: string;
  orderId?: string;
  eligibility?: EligibilityResult;
  consent?: Consent;
  enrolledAt?: string;
  /** Engagement history, newest first. */
  logs: DailyLog[];
  /** Consecutive-day sunrise streak. */
  streak: number;
}

/**
 * A pre-bound invite. The token opens the app already tied to a
 * patient record — this is what kills the typing on onboarding.
 */
export interface Invite {
  token: string;
  patientId: string;
  /** Order may already exist (Flow A) or be pending (Flow B). */
  orderId?: string;
  channel: EnrollChannel;
  createdAt: string;
}

export interface AppState {
  patients: Record<string, Patient>;
  orders: Record<string, RpmOrder>;
  invites: Record<string, Invite>;
  /** The patient currently signed in on this device. */
  currentPatientId?: string;
}
