import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function ForbiddenPage() {
  return (
    <div className="state-block" style={{ minHeight: '60vh' }}>
      <span className="state-icon" aria-hidden="true">
        🔒
      </span>
      <h1>403 — Access denied</h1>
      <p>Your account role doesn&apos;t have permission to view this page.</p>
      <Link to="/tickets">
        <Button>Back to tickets</Button>
      </Link>
    </div>
  );
}
