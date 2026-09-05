import { FormEvent, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import * as userService from '../services/userService';
import { useDebounce } from '../hooks/useDebounce';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { normalizeError } from '../api/client';
import { Role } from '../types';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const debouncedSearch = useDebounce(searchInput, 350);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery(
    () => userService.listUsers({ page, limit: 10, search: debouncedSearch || undefined, role: roleFilter || undefined }),
    [page, debouncedSearch, roleFilter],
  );

  async function handleRoleChange(userId: string, role: Role) {
    try {
      await userService.updateUser(userId, { role });
      showToast('Role updated', 'success');
      refetch();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    }
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    try {
      await userService.updateUser(userId, { isActive: !isActive });
      showToast(!isActive ? 'User activated' : 'User deactivated', 'success');
      refetch();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">Manage accounts, roles, and access.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>+ New user</Button>
      </div>

      <div className="toolbar">
        <div className="toolbar-field" style={{ minWidth: 240 }}>
          <Input
            label="Search users"
            hideLabel
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="Role"
            hideLabel
            placeholder="All roles"
            options={[
              { value: 'customer', label: 'Customer' },
              { value: 'agent', label: 'Agent' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as Role | '');
              setPage(1);
            }}
          />
        </div>
      </div>

      {isLoading && <TableSkeleton columns={5} />}
      {!isLoading && error && <ErrorState message={error.message} onRetry={refetch} />}
      {!isLoading && !error && data && data.users.length === 0 && (
        <EmptyState title="No users found" message="Try a different search or filter." />
      )}

      {!isLoading && !error && data && data.users.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <Select
                        label={`Role for ${u.name}`}
                        hideLabel
                        options={[
                          { value: 'customer', label: 'Customer' },
                          { value: 'agent', label: 'Agent' },
                          { value: 'admin', label: 'Admin' },
                        ]}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        disabled={u.id === currentUser?.id}
                      />
                    </td>
                    <td>
                      <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <CreateUserModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={refetch} />
    </div>
  );
}

function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('agent');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await userService.createUser({ name, email, password, role });
      showToast('User created', 'success');
      setName('');
      setEmail('');
      setPassword('');
      setRole('agent');
      onCreated();
      onClose();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create user">
      <form onSubmit={handleSubmit} noValidate>
        <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Temporary password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Select
          label="Role"
          options={[
            { value: 'customer', label: 'Customer' },
            { value: 'agent', label: 'Agent' },
            { value: 'admin', label: 'Admin' },
          ]}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
