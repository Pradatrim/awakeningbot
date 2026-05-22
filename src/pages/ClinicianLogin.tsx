import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';
import { api, setClinicianToken } from '../api';

/** Clinician dashboard sign-in. */
export default function ClinicianLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('nurse@medisun.care');
  const [password, setPassword] = useState('sunrise');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await api.clinicianLogin(email, password);
      setClinicianToken(r.token);
      nav('/clinician');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-scroll fade-in">
      <TopBar onBack={() => nav('/')} />
      <div className="center-col">
        <div style={{ fontSize: 48 }}>👩‍⚕️</div>
        <h1>Care team sign-in</h1>
        <p className="lead">The Medisun clinician dashboard.</p>
      </div>

      <div className="stack">
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            value={email}
            autoCapitalize="none"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="tiny" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={submit}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="tiny" style={{ textAlign: 'center' }}>
        Demo account is pre-filled — just tap Sign in.
      </p>
    </div>
  );
}
