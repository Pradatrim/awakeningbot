/* ============================================================
   Medisun Care — database (SQLite via better-sqlite3)

   Single-file embedded DB. The schema is the real persistence
   layer behind the API: patients, orders, invites, eligibility,
   consent, daily readings, clinicians and alerts all survive
   restarts and are shared across every device.
   ============================================================ */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'medisun.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id           TEXT PRIMARY KEY,
    state        TEXT NOT NULL,           -- free | pending-order | covered | not-covered
    channel      TEXT NOT NULL,           -- flow-a-doctor | flow-b-ad
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    dob          TEXT NOT NULL,
    phone        TEXT NOT NULL,
    mbi          TEXT NOT NULL,
    order_id     TEXT,
    enrolled_at  TEXT,
    streak       INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                TEXT PRIMARY KEY,
    patient_id        TEXT NOT NULL REFERENCES patients(id),
    source            TEXT NOT NULL,      -- doctor-referral | medisun-clinician
    ordering_provider TEXT NOT NULL,
    diagnosis         TEXT NOT NULL,
    created_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    token       TEXT PRIMARY KEY,
    patient_id  TEXT NOT NULL REFERENCES patients(id),
    order_id    TEXT,
    channel     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    consumed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS eligibility (
    id           TEXT PRIMARY KEY,
    patient_id   TEXT NOT NULL REFERENCES patients(id),
    eligible     INTEGER NOT NULL,
    plan         TEXT NOT NULL,
    monthly_cost INTEGER NOT NULL,
    message      TEXT NOT NULL,
    raw_271      TEXT,                     -- X12 271 response payload
    checked_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS consents (
    id            TEXT PRIMARY KEY,
    patient_id    TEXT NOT NULL REFERENCES patients(id),
    method        TEXT NOT NULL,          -- e-consent | verbal
    documented_by TEXT,
    given_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id          TEXT PRIMARY KEY,
    patient_id  TEXT NOT NULL REFERENCES patients(id),
    date        TEXT NOT NULL,            -- YYYY-MM-DD
    mood        TEXT,
    took_meds   INTEGER,
    bp_sys      INTEGER,
    bp_dia      INTEGER,
    heart_rate  INTEGER,
    complete    INTEGER NOT NULL DEFAULT 0,
    source      TEXT,                     -- manual | bluetooth-cuff | simulated
    created_at  TEXT NOT NULL,
    UNIQUE(patient_id, date)
  );

  CREATE TABLE IF NOT EXISTS clinicians (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    patient_id  TEXT NOT NULL REFERENCES patients(id),
    log_id      TEXT,
    severity    TEXT NOT NULL,            -- high | medium | low
    message     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open', -- open | resolved
    created_at  TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_logs_patient ON daily_logs(patient_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, severity);
`);

let seq = 0;
export function id(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function token(): string {
  return (
    Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
  );
}

export function now(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
