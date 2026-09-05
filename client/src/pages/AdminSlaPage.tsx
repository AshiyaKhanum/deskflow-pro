import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import * as slaService from '../services/slaService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { normalizeError } from '../api/client';
import { SlaPolicy } from '../types';

export function AdminSlaPage() {
  const { data, isLoading, error, refetch } = useQuery(() => slaService.listSlaPolicies(), []);

  if (isLoading) return <LoadingState label="Loading SLA policies…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>SLA Policies</h1>
          <p className="page-subtitle">
            Response and resolution targets by priority. Changes only apply to tickets created after the
            update - existing tickets keep the SLA that was active when they were opened.
          </p>
        </div>
      </div>

      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Priority</th>
              <th scope="col">Response time (h)</th>
              <th scope="col">Resolution time (h)</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((policy) => (
              <PolicyRow key={policy._id} policy={policy} onSaved={refetch} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PolicyRow({ policy, onSaved }: { policy: SlaPolicy; onSaved: () => void }) {
  const { showToast } = useToast();
  const [responseTimeHours, setResponseTimeHours] = useState(String(policy.responseTimeHours));
  const [resolutionTimeHours, setResolutionTimeHours] = useState(String(policy.resolutionTimeHours));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await slaService.updateSlaPolicy(policy._id, {
        responseTimeHours: Number(responseTimeHours),
        resolutionTimeHours: Number(resolutionTimeHours),
      });
      showToast(`${policy.priority} policy updated`, 'success');
      onSaved();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive() {
    try {
      await slaService.updateSlaPolicy(policy._id, { isActive: !policy.isActive });
      onSaved();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    }
  }

  return (
    <tr>
      <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{policy.priority}</td>
      <td>
        <Input
          label={`Response time for ${policy.priority}`}
          hideLabel
          type="number"
          min={0.25}
          step={0.25}
          value={responseTimeHours}
          onChange={(e) => setResponseTimeHours(e.target.value)}
          style={{ width: 90 }}
        />
      </td>
      <td>
        <Input
          label={`Resolution time for ${policy.priority}`}
          hideLabel
          type="number"
          min={0.5}
          step={0.5}
          value={resolutionTimeHours}
          onChange={(e) => setResolutionTimeHours(e.target.value)}
          style={{ width: 90 }}
        />
      </td>
      <td>
        <Badge variant={policy.isActive ? 'success' : 'neutral'}>{policy.isActive ? 'Active' : 'Inactive'}</Badge>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={handleSave} isLoading={isSaving}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={handleToggleActive}>
            {policy.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
