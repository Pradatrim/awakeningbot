/* ============================================================
   Eligibility route — live Medicare check (X12 270/271).
   Used by the specialist console and by in-app onboarding.
   ============================================================ */

import { Router } from 'express';
import { eligibilityAdapter } from '../eligibility/index.js';

export const eligibility = Router();

eligibility.post('/check', async (req, res) => {
  const { mbi, firstName, lastName, dob } = req.body ?? {};
  if (typeof mbi !== 'string' || mbi.trim().length < 4) {
    return res.status(400).json({ error: 'A Medicare number (MBI) is required.' });
  }
  try {
    const result = await eligibilityAdapter().check({
      mbi: mbi.trim(),
      firstName: firstName || 'UNKNOWN',
      lastName: lastName || 'UNKNOWN',
      dob: dob || '1950-01-01',
    });
    res.json({ eligibility: result });
  } catch (e: any) {
    res.status(502).json({ error: `Eligibility check failed: ${e.message}` });
  }
});
