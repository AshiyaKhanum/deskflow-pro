import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { normalizeError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      const from = (location.state as { from?: Location })?.from;
      // Only honor a saved "come back here" location if it's actually reachable for
      // this account's role - otherwise a stale deep link (e.g. from a previous
      // session, or a bookmarked admin page) would bounce a freshly-logged-in user
      // straight to /403, which looks exactly like "login is broken." With nothing
      // to return to, land each role somewhere that's always theirs to see: Admins
      // go to their Dashboard, everyone else goes to the ticket list.
      const fromPath = from?.pathname;
      const fromIsAdminOnly = !!fromPath && /^\/(dashboard|admin\/)/.test(fromPath);
      const canReturnTo = fromPath && (!fromIsAdminOnly || loggedInUser.role === 'admin');
      const destination = canReturnTo ? (from as unknown as string) : loggedInUser.role === 'admin' ? '/dashboard' : '/tickets';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemo(role: 'admin' | 'agent' | 'customer') {
    setEmail(`${role}@deskflow.demo`);
    setPassword('DeskflowDemo123!');
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <div>
            <div>DeskFlow Pro</div>
            <div className="brand-tagline">Modern Support Operations Platform</div>
          </div>
        </div>

        <h1>Sign in</h1>
        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="form-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}
          <Button type="submit" block isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p style={{ marginTop: 16, fontSize: '0.875rem' }}>
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>

        <div className="auth-demo-box">
          <strong>Demo accounts</strong> (password: <code>DeskflowDemo123!</code>)
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" type="button" onClick={() => fillDemo('customer')}>
              Customer
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => fillDemo('agent')}>
              Agent
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => fillDemo('admin')}>
              Admin
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
