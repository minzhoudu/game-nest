import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/useAuth';

export function SignupPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    register(email, password)
      .then(() => navigate('/'))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSubmitting(false));
  };

  // Same endpoint as the login page's Google button — Google sign-in
  // doesn't distinguish "new" from "existing" up front, AuthService.
  // loginWithGoogle() figures that out server-side (create, link, or just
  // log in) — see its comment for the full logic.
  const onGoogleCredential = (idToken: string) => {
    setError(null);
    loginWithGoogle(idToken)
      .then(() => navigate('/'))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="auth-page">
      <form className="create-form auth-form" onSubmit={onSubmit}>
        <h2>Sign up</h2>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <p className="muted">At least 8 characters.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
        <div className="auth-divider">or</div>
        <GoogleSignInButton onCredential={onGoogleCredential} />
      </form>
    </div>
  );
}
