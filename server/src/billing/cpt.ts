/* ============================================================
   Medicare RPM CPT codes.

   Remote Physiologic Monitoring is billed with four CPT codes,
   each with its own coverage rule. Rates below are illustrative
   national Medicare Physician Fee Schedule non-facility amounts
   (a production deploy loads the current locality-adjusted fee
   schedule).
   ============================================================ */

export interface CptDef {
  code: string;
  label: string;
  /** Plain-language coverage rule. */
  rule: string;
  /** Illustrative national Medicare allowed amount, USD. */
  rate: number;
  /** false = once per episode of care, not per month. */
  recurring: boolean;
}

export const CPT: Record<string, CptDef> = {
  '99453': {
    code: '99453',
    label: 'RPM setup & patient education',
    rule: 'Billed once, after the first device reading is captured.',
    rate: 19.32,
    recurring: false,
  },
  '99454': {
    code: '99454',
    label: 'RPM device supply & daily readings',
    rule: 'Requires at least 16 days of readings within a 30-day period.',
    rate: 43.02,
    recurring: true,
  },
  '99457': {
    code: '99457',
    label: 'RPM treatment management, first 20 minutes',
    rule: 'Requires at least 20 minutes of clinical time in the month.',
    rate: 48.14,
    recurring: true,
  },
  '99458': {
    code: '99458',
    label: 'RPM treatment management, each additional 20 minutes',
    rule: 'Each unit requires another full 20 minutes of clinical time.',
    rate: 38.64,
    recurring: true,
  },
};

/** Minimum device-reading days for 99454 within the period. */
export const MIN_READING_DAYS = 16;
/** Minimum clinical minutes for 99457. */
export const MIN_MINUTES_99457 = 20;
/** Medicare allows at most two 99458 add-on units per month. */
export const MAX_99458_UNITS = 2;

/** Medicare Part B pays 80%; the patient (or supplemental) covers 20%. */
export const PAYER_COINSURANCE = 0.8;

/** Extracts an ICD-10 code from a free-text diagnosis. */
export function extractIcd10(diagnosis: string): string {
  const paren = diagnosis.match(/\(([^)]+)\)/);
  const candidate = (paren ? paren[1] : diagnosis).trim().toUpperCase();
  const icd = candidate.match(/[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?/);
  return icd ? icd[0] : 'I10';
}

/** Current billing period, YYYY-MM. */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** First and last calendar day of a YYYY-MM period. */
export function periodBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number);
  const from = `${period}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${period}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}
