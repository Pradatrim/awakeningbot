/* ============================================================
   X12 837P — professional healthcare claim.

   Medicare professional claims are submitted as ASC X12N 837P
   (005010X222A1) EDI. This builds a structurally faithful 837P:
   the ISA/GS envelope, submitter/receiver/billing-provider/
   subscriber/payer loops, the 2300 claim, the HI diagnosis, and
   one 2400 service line per CPT code.

   It is format-faithful, not payer-certified — a production
   deploy supplies real submitter IDs, the billing NPI/TIN and a
   contracted clearinghouse connection.
   ============================================================ */

export interface Claim837Line {
  cpt: string;
  charge: number;
  units: number;
  serviceFrom: string; // YYYY-MM-DD
  serviceTo: string; // YYYY-MM-DD
}

export interface Claim837Input {
  claimId: string;
  controlNumber: string;
  payer: string;
  dxCode: string;
  totalCharge: number;
  patient: { firstName: string; lastName: string; dob: string; mbi: string };
  renderingProvider: string;
}

const SEG = '~';

function ymd(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8);
}
function pad(s: string, n: number): string {
  return (s + ' '.repeat(n)).slice(0, n);
}

export function build837P(input: Claim837Input, lines: Claim837Line[]): string {
  const ctrl = input.controlNumber;
  const d = new Date();
  const ccyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const yymmdd = ccyymmdd.slice(2);
  const hhmm = d.toISOString().slice(11, 16).replace(':', '');
  const dx = input.dxCode.replace('.', '');

  const segs: string[] = [
    `ISA*00*${pad('', 10)}*00*${pad('', 10)}*ZZ*${pad('MEDISUNCARE', 15)}*ZZ*${pad('CMSMEDICARE', 15)}*${yymmdd}*${hhmm}*^*00501*${ctrl}*0*P*:`,
    `GS*HC*MEDISUNCARE*CMSMEDICARE*${ccyymmdd}*${hhmm}*${ctrl}*X*005010X222A1`,
    `ST*837*0001*005010X222A1`,
    `BHT*0019*00*${input.claimId}*${ccyymmdd}*${hhmm}*CH`,
    // 1000A submitter
    `NM1*41*2*MEDISUN CARE*****46*MEDISUNCARE`,
    `PER*IC*MEDISUN BILLING*TE*8006334786`,
    // 1000B receiver
    `NM1*40*2*MEDICARE*****46*CMSMEDICARE`,
    // 2000A / 2010AA billing provider
    `HL*1**20*1`,
    `NM1*85*2*MEDISUN CARE*****XX*1999999999`,
    `N3*100 SUNRISE WAY`,
    `N4*AUSTIN*TX*78701`,
    `REF*EI*474829100`,
    // 2000B / 2010BA subscriber (the patient is the subscriber for Medicare)
    `HL*2*1*22*0`,
    `SBR*P*18*******MB`,
    `NM1*IL*1*${input.patient.lastName.toUpperCase()}*${input.patient.firstName.toUpperCase()}****MI*${input.patient.mbi.replace(/-/g, '').toUpperCase()}`,
    `DMG*D8*${ymd(input.patient.dob)}*U`,
    // 2010BB payer
    `NM1*PR*2*${input.payer.toUpperCase()}*****PI*CMSMEDICARE`,
    // 2300 claim
    `CLM*${input.claimId}*${input.totalCharge.toFixed(2)}***11:B:1*Y*A*Y*Y`,
    `HI*ABK:${dx}`,
  ];

  // 2400 service lines — one per CPT code.
  lines.forEach((ln, i) => {
    segs.push(`LX*${i + 1}`);
    segs.push(
      `SV1*HC:${ln.cpt}*${ln.charge.toFixed(2)}*UN*${ln.units}***1`,
    );
    segs.push(`DTP*472*RD8*${ymd(ln.serviceFrom)}-${ymd(ln.serviceTo)}`);
  });

  // SE counts segments from ST through SE inclusive.
  const stIndex = segs.findIndex((s) => s.startsWith('ST*'));
  const seCount = segs.length - stIndex + 1;
  segs.push(`SE*${seCount}*0001`);
  segs.push(`GE*1*${ctrl}`, `IEA*1*${ctrl}`);

  return segs.join(SEG) + SEG;
}
