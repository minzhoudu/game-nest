import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ServerStatus } from '@gamenest/shared-types';
import { api } from '../api/client';
import { CopyableAddress } from '../components/CopyableAddress';
import { StatusBadge } from '../components/StatusBadge';
import { useServers } from '../hooks/useServers';
import { connectAddress } from '../lib/connect-address';

const BUSY_STATUSES = new Set<ServerStatus>([
  ServerStatus.CREATING,
  ServerStatus.STARTING,
  ServerStatus.STOPPING,
  ServerStatus.DELETING,
]);

export function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: servers, isLoading } = useServers();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const server = servers?.find((s) => s.id === id);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['servers'] });
  const runAction = (action: () => Promise<unknown>) => {
    setError(null);
    return action()
      .then(invalidate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  const startMutation = useMutation({ mutationFn: () => runAction(() => api.startServer(id!)) });
  const stopMutation = useMutation({ mutationFn: () => runAction(() => api.stopServer(id!)) });
  const deleteMutation = useMutation({
    mutationFn: () => runAction(() => api.deleteServer(id!)),
    onSuccess: () => navigate('/'),
  });

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  if (!server) {
    return (
      <section>
        <p className="muted">No server found with that id — it may have been deleted.</p>
        <Link to="/">← Back to servers</Link>
      </section>
    );
  }

  const busy =
    BUSY_STATUSES.has(server.status) || startMutation.isPending || stopMutation.isPending || deleteMutation.isPending;
  const address = connectAddress(server);

  return (
    <section>
      <Link to="/" className="back-link">
        ← Servers
      </Link>

      <div className="section-header">
        <div>
          <h2>{server.name}</h2>
          <p className="muted">
            {server.templateSlug} · node {server.nodeId.slice(0, 8)}
          </p>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {address && (
        <p>
          <CopyableAddress address={address} />
        </p>
      )}

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
        <Link to={`/servers/${server.id}/logs`}>
          <button type="button" className="ghost">
            View logs
          </button>
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
