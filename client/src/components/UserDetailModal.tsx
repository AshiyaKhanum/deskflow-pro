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
 *
 * Pass `user` instead of `userId` to show an already-known account (e.g. "view my
 * own account" from the sidebar) without a fetch - GET /api/users/:id is admin-only,
 * so a customer/agent viewing their own details never has that lookup available, but
 * they already have their own live record from /auth/me via useAuth().
 */
export function UserDetailModal({
  userId,
  user: providedUser,
  onClose,
}: {
  userId?: string | null;
  user?: User | null;
  onClose: () => void;
}) {
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (providedUser || !userId) return;
    let cancelled = false;
    setFetchedUser(null);
    setError(null);
    setIsLoading(true);
    userService
      .getUser(userId)
      .then((result) => {
        if (!cancelled) setFetchedUser(result);
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
  }, [userId, providedUser]);

  const user = providedUser ?? fetchedUser;
  const isOpen = !!providedUser || !!userId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account details">
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
