import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { CreateServerForm } from './CreateServerForm';
import { ServerCard } from './ServerCard';

const SERVERS_POLL_MS = 3000;

export function ServerList() {
  const [creating, setCreating] = useState(false);
  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: api.listServers,
    refetchInterval: SERVERS_POLL_MS,
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
