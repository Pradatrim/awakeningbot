/* ============================================================
   Medisun Care — API server.

   Express + SQLite. Hosts both onboarding flows, the patient
   app, and the clinician dashboard. Run with `npm run dev`
   (starts this alongside the Vite client) or `npm run server`.
   ============================================================ */

import express from 'express';
import cors from 'cors';
import { enroll } from './routes/enroll.js';
import { patient } from './routes/patient.js';
import { clinician } from './routes/clinician.js';
import { eligibility } from './routes/eligibility.js';
import { billing } from './routes/billing.js';
import { issueToken } from './auth.js';
import { loadPatient } from './model.js';
import { recomputeStreak } from './logic.js';
import { DEMO_ELDER_ID, ensureSeed } from './seed.js';

ensureSeed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/enroll', enroll);
app.use('/api/patient', patient);
app.use('/api/clinician', clinician);
app.use('/api/eligibility', eligibility);
app.use('/api/billing', billing);

/**
 * Dev convenience — signs in as the seeded demo elder so the
 * daily app can be explored without walking onboarding.
 */
app.post('/api/dev/demo-login', (_req, res) => {
  ensureSeed();
  recomputeStreak(DEMO_ELDER_ID); // keep the streak honest as days pass
  const p = loadPatient(DEMO_ELDER_ID)!;
  const sessionToken = issueToken({ scope: 'patient', sub: p.id, name: p.firstName });
  res.json({ patient: p, sessionToken });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`[server] Medisun API listening on :${PORT}`));
