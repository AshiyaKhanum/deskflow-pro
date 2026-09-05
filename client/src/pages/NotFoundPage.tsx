import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="state-block" style={{ minHeight: '60vh' }}>
      <span className="state-icon" aria-hidden="true">
        🧭
      </span>
      <h1>Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
      <Link to="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
