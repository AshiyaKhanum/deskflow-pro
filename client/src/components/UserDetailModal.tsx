import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { LoadingState, ErrorState } from './ui/States';
import * as userService from '../services/userService';
import { normalizeError, NormalizedApiError } from '../api/client';
import { formatDateTime } from '../utils/format';
import { User } from '../types';

/**
 * Fetches and shows one user's real account details, by id, from the database -
 * every time it opens. Never renders a cached/static copy: closing and reopening
 * for a different id always triggers a fresh GET /api/users/:id.
 */
export function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setUser(null);
    setError(null);
    setIsLoading(true);
    userService
      .getUser(userId)
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Modal isOpen={!!userId} onClose={onClose} title="Account details">
      {isLoading && <LoadingState label="Loading account…" />}
      {!isLoading && error && <ErrorState message={error.message} />}
      {!isLoading && !error && user && (
        <dl>
          <div className="detail-row">
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="detail-row">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="detail-row">
            <dt>Role</dt>
            <dd style={{ textTransform: 'capitalize' }}>{user.role}</dd>
          </div>
          <div className="detail-row">
            <dt>Status</dt>
            <dd>
              <Badge variant={user.isActive ? 'success' : 'danger'}>
                {user.isActive ? 'Active' : 'Deactivated'}
              </Badge>
            </dd>
          </div>
          <div className="detail-row">
            <dt>Member since</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
