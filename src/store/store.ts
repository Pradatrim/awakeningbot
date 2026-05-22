/* ============================================================
   Medisun Care — patient-app store.

   A small observable around the signed-in patient. The server is
   the source of truth; this just caches the current patient and
   notifies React when it changes.
   ============================================================ */

import { useSyncExternalStore } from 'react';
import { api, getPatientToken, setPatientToken } from '../api';
import type { Alert, DailyLog, Patient } from './types';

let patient: Patient | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setPatient(p: Patient | undefined) {
  patient = p;
  emit();
}

/** Re-fetches the signed-in patient. Clears the session on 401. */
export async function refreshMe(): Promise<Patient | undefined> {
  if (!getPatientToken()) {
    setPatient(undefined);
    return undefined;
  }
  try {
    const p = await api.me();
    setPatient(p);
    return p;
  } catch {
    setPatientToken(null);
    setPatient(undefined);
    return undefined;
  }
}

/** Signs in as the seeded demo elder. */
export async function demoLogin(): Promise<Patient> {
  const { patient: p, sessionToken } = await api.demoLogin();
  setPatientToken(sessionToken);
  setPatient(p);
  return p;
}

/** Adopts a session minted by completing an invite. */
export function adoptSession(sessionToken: string, p: Patient): void {
  setPatientToken(sessionToken);
  setPatient(p);
}

export function signOut(): void {
  setPatientToken(null);
  setPatient(undefined);
}

export async function checkIn(input: {
  mood?: string;
  tookMeds?: boolean;
  bp?: { sys: number; dia: number };
  heartRate?: number;
  source?: string;
}): Promise<{ patient: Patient; log: DailyLog; alerts: Alert[] }> {
  const r = await api.checkIn(input);
  setPatient(r.patient);
  return r;
}

export function hasSession(): boolean {
  return !!getPatientToken();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive access to the signed-in patient. */
export function useCurrentPatient(): Patient | undefined {
  return useSyncExternalStore(
    subscribe,
    () => patient,
    () => patient,
  );
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
