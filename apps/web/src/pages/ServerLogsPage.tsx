import { Link, useParams } from 'react-router-dom';
import { ServerLogs } from '../components/ServerLogs';
import { StatusBadge } from '../components/StatusBadge';
import { useServers } from '../hooks/useServers';

export function ServerLogsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: servers } = useServers();
  const server = servers?.find((s) => s.id === id);

  return (
    <section>
      <Link to={id ? `/servers/${id}` : '/'} className="back-link">
        ← {server ? server.name : 'Back'}
      </Link>

      <div className="section-header">
        <h2>Logs</h2>
        {server && <StatusBadge status={server.status} />}
      </div>

      {id && <ServerLogs serverId={id} />}
    </section>
  );
}
