/* ============================================================
   Medisun Care — client types (mirror the API DTOs).
   ============================================================ */

export type PatientState = 'free' | 'pending-order' | 'covered' | 'not-covered';
export type EnrollChannel = 'flow-a-doctor' | 'flow-b-ad';
export type OrderSource = 'doctor-referral' | 'medisun-clinician';

export interface Order {
  id: string;
  source: OrderSource;
  orderingProvider: string;
  diagnosis: string;
  createdAt: string;
}

export interface Eligibility {
  eligible: boolean;
  plan: string;
  monthlyCost: number;
  message: string;
  checkedAt?: string;
  /** Raw X12 271 payload from the clearinghouse. */
  raw271?: string;
  adapter?: string;
}

export interface Consent {
  method: 'e-consent' | 'verbal';
  documentedBy?: string;
  givenAt: string;
}

export interface DailyLog {
  date: string;
  mood?: 'great' | 'okay' | 'rough';
  tookMeds?: boolean;
  bp?: { sys: number; dia: number };
  heartRate?: number;
  complete: boolean;
  /** manual | bluetooth-cuff | simulated */
  source?: string;
}

export interface Alert {
  id: string;
  patientId: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface Patient {
  id: string;
  state: PatientState;
  channel: EnrollChannel;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  mbi: string;
  orderId?: string;
  enrolledAt?: string;
  streak: number;
  order?: Order;
  eligibility?: Eligibility;
  consent?: Consent;
  logs: DailyLog[];
}

export interface Invite {
  token: string;
  channel: EnrollChannel;
  consumedAt?: string;
}

/* ---- billing ---- */

export interface CptAssessment {
  code: string;
  label: string;
  rule: string;
  rate: number;
  billable: boolean;
  units: number;
  charge: number;
  reason: string;
}

export interface BillingAssessment {
  patientId: string;
  patientName: string;
  period: string;
  periodFrom: string;
  periodTo: string;
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

export interface ClaimLine {
  id: string;
  cpt: string;
  description: string;
  units: number;
  rate: number;
  charge: number;
  dxCode: string;
  serviceFrom: string;
  serviceTo: string;
  supporting?: string;
}

export interface Claim {
  id: string;
  patientId: string;
  patientName: string;
  period: string;
  status: 'draft' | 'submitted' | 'paid' | 'denied';
  payer: string;
  diagnosisCode: string;
  totalCharge: number;
  payerPaid?: number;
  patientResponsibility?: number;
  controlNumber?: string;
  x12_837?: string;
  denialReason?: string;
  createdAt: string;
  submittedAt?: string;
  paidAt?: string;
  lines: ClaimLine[];
}

export interface TimeLog {
  id: string;
  patientId: string;
  clinicianName?: string;
  minutes: number;
  note?: string;
  serviceDate: string;
  createdAt: string;
}

/** Summary row on the clinician panel. */
export interface PanelPatient {
  id: string;
  firstName: string;
  lastName: string;
  state: PatientState;
  streak: number;
  latestReading?: DailyLog;
  openAlertCount: number;
  topSeverity?: 'high' | 'medium' | 'low';
}
