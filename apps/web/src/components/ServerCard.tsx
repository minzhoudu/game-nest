import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ServerStatus } from '@gamenest/shared-types';
import type { ManagedServer } from '../api/client';
import { api } from '../api/client';
import { ServerLogs } from './ServerLogs';
import { StatusBadge } from './StatusBadge';

const BUSY_STATUSES = new Set<ServerStatus>([
  ServerStatus.CREATING,
  ServerStatus.STARTING,
  ServerStatus.STOPPING,
  ServerStatus.DELETING,
]);

export function ServerCard({ server }: { server: ManagedServer }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['servers'] });

  const runAction = (action: () => Promise<unknown>) => {
    setError(null);
    return action()
      .then(invalidate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  const startMutation = useMutation({ mutationFn: () => runAction(() => api.startServer(server.id)) });
  const stopMutation = useMutation({ mutationFn: () => runAction(() => api.stopServer(server.id)) });
  const deleteMutation = useMutation({ mutationFn: () => runAction(() => api.deleteServer(server.id)) });

  const busy = BUSY_STATUSES.has(server.status) || startMutation.isPending || stopMutation.isPending || deleteMutation.isPending;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>{server.name}</h3>
          <p className="muted">
            {server.templateSlug} · node {server.nodeId.slice(0, 8)}
          </p>
        </div>
        <StatusBadge status={server.status} />
      </div>

      <div className="card-actions">
        {server.status === ServerStatus.RUNNING ? (
          <button type="button" disabled={busy} onClick={() => stopMutation.mutate()}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || server.status === ServerStatus.DELETING}
            onClick={() => startMutation.mutate()}
          >
            Start
          </button>
        )}
        <button type="button" className="danger" disabled={busy} onClick={() => deleteMutation.mutate()}>
          Delete
        </button>
        <button type="button" className="ghost" onClick={() => setLogsOpen((v) => !v)}>
          {logsOpen ? 'Hide logs' : 'View logs'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {logsOpen && <ServerLogs serverId={server.id} />}
    </div>
  );
}
