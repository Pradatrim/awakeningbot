/* ============================================================
   Auth — JWT sessions.

   Two principals:
   - patient   : signed in by completing a pre-bound invite. The
                 invite token is the credential; finishing
                 onboarding mints a durable session JWT so the
                 patient stays signed in across devices.
   - clinician : email + password login for the care dashboard.
   ============================================================ */

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const SECRET = process.env.MEDISUN_JWT_SECRET || 'dev-only-medisun-secret-change-me';
const TTL = '30d';

export interface Principal {
  scope: 'patient' | 'clinician';
  sub: string; // patientId or clinicianId
  name?: string;
}

export function issueToken(p: Principal): string {
  return jwt.sign(p, SECRET, { expiresIn: TTL });
}

export function verifyToken(raw: string): Principal | null {
  try {
    return jwt.verify(raw, SECRET) as Principal;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

function bearer(req: Request): string | null {
  const h = req.header('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

/** Requires a valid JWT of the given scope. */
export function requireScope(scope: 'patient' | 'clinician') {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = bearer(req);
    const principal = raw ? verifyToken(raw) : null;
    if (!principal || principal.scope !== scope) {
      return res.status(401).json({ error: 'Not signed in.' });
    }
    req.principal = principal;
    next();
  };
}
