/* ============================================================
   Mock Medicare eligibility check.

   In production this calls a clearinghouse / payer API. For the
   prototype it runs a short fake "lookup" and derives a result
   from the MBI so the same card always returns the same answer.
   ============================================================ */

import type { EligibilityResult } from './types';

const PLANS = [
  'Medicare Part B',
  'Medicare Advantage — UnitedHealthcare',
  'Medicare Advantage — Humana Gold',
  'Medicare Part B + Medigap Plan G',
];

/** RPM patient cost-share. 0 means the supplemental plan covers it. */
const COSTS = [0, 0, 0, 8];

/** Deterministic hash so a given MBI is stable across runs. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function runEligibilityCheck(mbi: string): Promise<EligibilityResult> {
  const clean = mbi.replace(/\s+/g, '').toUpperCase();
  const h = hash(clean || 'UNKNOWN');

  // ~1 in 7 cards come back ineligible → routed to the free tier.
  const eligible = clean.length >= 6 && h % 7 !== 0;
  const plan = PLANS[h % PLANS.length];
  const monthlyCost = eligible ? COSTS[h % COSTS.length] : 0;

  const message = !eligible
    ? "We could not confirm Medicare RPM coverage for this card."
    : monthlyCost === 0
      ? 'Great news — fully covered. $0 per month for you.'
      : `Covered. Your share is about $${monthlyCost} per month.`;

  // Simulate a 2–5 second clearinghouse round-trip.
  const delay = 2000 + (h % 3000);
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          checkedAt: new Date().toISOString(),
          eligible,
          plan,
          monthlyCost,
          message,
        }),
      delay,
    ),
  );
}
