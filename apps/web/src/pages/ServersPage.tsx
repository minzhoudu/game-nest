import { Link } from 'react-router-dom';
import { CopyableAddress } from '../components/CopyableAddress';
import { StatusBadge } from '../components/StatusBadge';
import { useServers } from '../hooks/useServers';
import { connectAddress } from '../lib/connect-address';

export function ServersPage() {
  const { data: servers, isLoading } = useServers();

  return (
    <section>
      <div className="section-header">
        <h2>Servers</h2>
        <Link to="/servers/new">
          <button type="button">+ New server</button>
        </Link>
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : !servers || servers.length === 0 ? (
        <p className="muted">No servers yet. Create one to get started.</p>
      ) : (
        <div className="server-grid">
          {servers.map((server) => {
            const address = connectAddress(server);
            return (
              <Link to={`/servers/${server.id}`} className="card card-link" key={server.id}>
                <div className="card-header">
                  <div>
                    <h3>{server.name}</h3>
                    <p className="muted">{server.templateSlug}</p>
                  </div>
                  <StatusBadge status={server.status} />
                </div>
                {address && (
                  // Stop the click from bubbling to the surrounding <Link> — otherwise
                  // pressing "Copy" would also navigate to the detail page.
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <CopyableAddress address={address} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
