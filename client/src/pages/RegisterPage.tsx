import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { normalizeError } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/tickets', { replace: true });
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
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

        <h1>Create your account</h1>
        <p style={{ marginBottom: 20 }}>New accounts are created as customers. Ask an admin for agent access.</p>
        <form onSubmit={handleSubmit} noValidate>
          <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
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
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters, including a letter and a number."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="form-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}
          <Button type="submit" block isLoading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p style={{ marginTop: 16, fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
