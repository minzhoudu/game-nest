import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { CreateServerForm } from './CreateServerForm';
import { ServerCard } from './ServerCard';

export function ServerList() {
  const [creating, setCreating] = useState(false);
  // One fetch as a fallback; useDashboardSocket() (mounted in App) keeps
  // this current after that via server.created/status/removed events.
  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: api.listServers,
    staleTime: Infinity,
  });

  return (
    <section>
      <div className="section-header">
        <h2>Servers</h2>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}>
            + New server
          </button>
        )}
      </div>

      {creating && <CreateServerForm onDone={() => setCreating(false)} />}

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : !servers || servers.length === 0 ? (
        <p className="muted">No servers yet. Create one to get started.</p>
      ) : (
        <div className="server-grid">
          {servers.map((server) => (
            <ServerCard server={server} key={server.id} />
          ))}
        </div>
      )}
    </section>
  );
}
