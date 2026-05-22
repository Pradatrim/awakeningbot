/* ============================================================
   Eligibility service — swappable clearinghouse adapter.

   The factory picks a real clearinghouse adapter when the
   environment is configured (CLEARINGHOUSE_URL + _API_KEY), and
   otherwise the deterministic mock. Both return the same shape,
   including the raw X12 271 payload, so swapping in a contracted
   clearinghouse is a configuration change — not a code change.
   ============================================================ */

import { build270, parse271, synth271, type EligibilityDecision, type EligibilityRequest } from './x12.js';

export type { EligibilityRequest, EligibilityDecision } from './x12.js';

export interface EligibilityResponse {
  eligible: boolean;
  plan: string;
  monthlyCost: number;
  message: string;
  /** The raw X12 271 payload, retained for audit. */
  raw271: string;
  /** Which adapter produced this result. */
  adapter: string;
}

export interface EligibilityAdapter {
  name: string;
  check(req: EligibilityRequest): Promise<EligibilityResponse>;
}

function message(d: EligibilityDecision): string {
  if (!d.eligible) return 'We could not confirm Medicare RPM coverage for this card.';
  return d.monthlyCost === 0
    ? 'Great news — fully covered. $0 per month for you.'
    : `Covered. Your share is about $${d.monthlyCost} per month.`;
}

/* ---- deterministic mock ---- */

const PLANS = [
  'Medicare Part B',
  'Medicare Advantage UHC',
  'Medicare Advantage Humana Gold',
  'Medicare Part B Medigap Plan G',
];
const COSTS = [0, 0, 0, 8];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

class MockAdapter implements EligibilityAdapter {
  name = 'mock-clearinghouse';

  async check(req: EligibilityRequest): Promise<EligibilityResponse> {
    const clean = req.mbi.replace(/\s+/g, '').toUpperCase();
    const h = hash(clean || 'UNKNOWN');
    const decision: EligibilityDecision = {
      eligible: clean.length >= 6 && h % 7 !== 0,
      plan: PLANS[h % PLANS.length],
      monthlyCost: 0,
    };
    if (decision.eligible) decision.monthlyCost = COSTS[h % COSTS.length];

    // Build the 270, synthesize the matching 271, then parse it
    // back — the same parser the real adapter uses.
    build270(req);
    const raw271 = synth271(req, decision);
    const parsed = parse271(raw271);

    // Simulate a 1.2–3s clearinghouse round-trip.
    await new Promise((r) => setTimeout(r, 1200 + (h % 1800)));

    return {
      ...parsed,
      message: message(parsed),
      raw271,
      adapter: this.name,
    };
  }
}

/* ---- real clearinghouse adapter ---- */

class ClearinghouseAdapter implements EligibilityAdapter {
  name = 'x12-clearinghouse';
  constructor(
    private url: string,
    private apiKey: string,
  ) {}

  async check(req: EligibilityRequest): Promise<EligibilityResponse> {
    const x12_270 = build270(req);
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/edi-x12',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: x12_270,
    });
    if (!res.ok) throw new Error(`Clearinghouse responded ${res.status}`);
    const raw271 = await res.text();
    const parsed = parse271(raw271);
    return { ...parsed, message: message(parsed), raw271, adapter: this.name };
  }
}

let adapter: EligibilityAdapter | null = null;

export function eligibilityAdapter(): EligibilityAdapter {
  if (adapter) return adapter;
  const url = process.env.CLEARINGHOUSE_URL;
  const key = process.env.CLEARINGHOUSE_API_KEY;
  if (url && key) {
    adapter = new ClearinghouseAdapter(url, key);
    console.log('[eligibility] using real clearinghouse adapter');
  } else {
    adapter = new MockAdapter();
    console.log('[eligibility] CLEARINGHOUSE_URL not set — using mock adapter');
  }
  return adapter;
}
