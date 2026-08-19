import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../api/client';

/**
 * Fetches the current log buffer once on mount, then relies on
 * useDashboardSocket() (mounted in App) to append new `server.log` lines to
 * this exact query key as they arrive — no polling, no re-fetching the
 * whole buffer just to pick up one new line.
 */
export function ServerLogs({ serverId }: { serverId: string }) {
  const { data: lines } = useQuery({
    queryKey: ['server-logs', serverId],
    queryFn: () => api.getServerLogs(serverId),
    staleTime: Infinity,
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
