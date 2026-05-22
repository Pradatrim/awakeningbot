/* ============================================================
   X12 EDI 270/271 — Medicare eligibility transactions.

   Real Medicare eligibility runs over the ASC X12N 270 (request)
   / 271 (response) transaction set, exchanged with a
   clearinghouse. This module builds a 270 and parses a 271 so the
   rest of the system speaks a real, certifiable format.

   The 270 here is structurally faithful (005010X279A1 envelope,
   HL hierarchy, EQ service-type loop) but not payer-certified —
   a production deploy swaps in real submitter/receiver IDs and a
   contracted clearinghouse endpoint.
   ============================================================ */

export interface EligibilityRequest {
  mbi: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
}

export interface EligibilityDecision {
  eligible: boolean;
  plan: string;
  /** Patient monthly cost share, USD. 0 = supplemental covers it. */
  monthlyCost: number;
}

const SEG = '~';
const EL = '*';

function pad(s: string, n: number): string {
  return (s + ' '.repeat(n)).slice(0, n);
}
function stamp() {
  const d = new Date();
  const ccyy = d.toISOString().slice(0, 10).replace(/-/g, '');
  const yymmdd = ccyy.slice(2);
  const hhmm = d.toISOString().slice(11, 16).replace(':', '');
  return { ccyy, yymmdd, hhmm };
}

/** Builds an ASC X12N 005010X279A1 270 eligibility-inquiry payload. */
export function build270(req: EligibilityRequest, ctrl = '000000001'): string {
  const { ccyy, yymmdd, hhmm } = stamp();
  const dob = req.dob.replace(/-/g, '');
  const segs = [
    `ISA*00*${pad('', 10)}*00*${pad('', 10)}*ZZ*${pad('MEDISUNCARE', 15)}*ZZ*${pad('CLEARINGHOUSE', 15)}*${yymmdd}*${hhmm}*^*00501*${ctrl}*0*P*:`,
    `GS*HS*MEDISUNCARE*CLEARINGHOUSE*${ccyy}*${hhmm}*${ctrl}*X*005010X279A1`,
    `ST*270*0001*005010X279A1`,
    `BHT*0022*13*MEDISUN-${ctrl}*${ccyy}*${hhmm}`,
    `HL*1**20*1`,
    `NM1*PR*2*MEDICARE*****PI*MEDICARE`,
    `HL*2*1*21*1`,
    `NM1*1P*2*MEDISUN CARE*****XX*1999999999`,
    `HL*3*2*22*0`,
    `TRN*1*${ctrl}*9MEDISUNCARE`,
    `NM1*IL*1*${req.lastName.toUpperCase()}*${req.firstName.toUpperCase()}****MI*${req.mbi.toUpperCase()}`,
    `DMG*D8*${dob}`,
    `DTP*291*D8*${ccyy}`,
    `EQ*30`, // service type 30 — Health Benefit Plan Coverage
  ];
  segs.push(`SE*${segs.length - 2}*0001`);
  segs.push(`GE*1*${ctrl}`, `IEA*1*${ctrl}`);
  return segs.join(SEG) + SEG;
}

/**
 * Synthesizes a 271 response for a decision — used by the mock
 * adapter so the 271 parser below is exercised on a real payload
 * rather than bypassed.
 */
export function synth271(req: EligibilityRequest, d: EligibilityDecision): string {
  const { ccyy, hhmm } = stamp();
  const segs = [
    `ST*271*0001*005010X279A1`,
    `BHT*0022*11*MEDISUN-RESP*${ccyy}*${hhmm}`,
    `HL*1**20*1`,
    `NM1*PR*2*${d.plan.toUpperCase()}*****PI*MEDICARE`,
    `HL*2*1*21*1`,
    `NM1*1P*2*MEDISUN CARE`,
    `HL*3*2*22*0`,
    `NM1*IL*1*${req.lastName.toUpperCase()}*${req.firstName.toUpperCase()}****MI*${req.mbi.toUpperCase()}`,
  ];
  if (d.eligible) {
    // EB*1 — Active Coverage, service type 30.
    segs.push(`EB*1*IND*30**${d.plan.toUpperCase()}`);
    // EB*B — Co-Payment for the RPM benefit, monthly amount in EB07.
    segs.push(`EB*B*IND*30**MEDISUN RPM*${d.monthlyCost.toFixed(2)}`);
  } else {
    // EB*6 — Inactive coverage for this benefit.
    segs.push(`EB*6*IND*30`);
  }
  segs.push(`SE*${segs.length + 1}*0001`);
  return segs.join(SEG) + SEG;
}

/** Parses a 271 payload into an eligibility decision. */
export function parse271(x12: string): EligibilityDecision {
  const segs = x12
    .split(SEG)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(EL));

  let plan = 'Medicare';
  let eligible = false;
  let monthlyCost = 0;

  for (const s of segs) {
    if (s[0] === 'NM1' && s[1] === 'PR' && s[3]) {
      plan = titleCase(s[3]);
    }
    if (s[0] === 'EB') {
      if (s[1] === '1') eligible = true; // Active Coverage
      if (s[1] === 'B') {
        // Co-Payment segment — amount is the last populated element.
        const amt = parseFloat(s[s.length - 1]);
        if (!Number.isNaN(amt)) monthlyCost = Math.round(amt);
      }
    }
  }
  return { eligible, plan, monthlyCost };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bUhc\b/i, 'UnitedHealthcare');
}
