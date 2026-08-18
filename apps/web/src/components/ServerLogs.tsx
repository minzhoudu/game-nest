import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../api/client';

const LOGS_POLL_MS = 2000;

/**
 * Polls GET /servers/:id/logs while mounted. Not live-pushed over a socket
 * yet (the WS pipeline that captures these lines already exists —
 * see agent-events.ts — this just isn't wired to the dashboard yet).
 * Polling every 2s is a fine MVP substitute.
 */
export function ServerLogs({ serverId }: { serverId: string }) {
  const { data: lines } = useQuery({
    queryKey: ['server-logs', serverId],
    queryFn: () => api.getServerLogs(serverId),
    refetchInterval: LOGS_POLL_MS,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  return (
    <div className="logs">
      {!lines || lines.length === 0 ? (
        <div className="logs-empty">No log lines yet — the server may still be starting up.</div>
      ) : (
        lines.map((line, i) => (
          // Lines are an append-only tail with no stable id; index is fine here.
          // eslint-disable-next-line react/no-array-index-key
          <div className="logs-line" key={i}>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
