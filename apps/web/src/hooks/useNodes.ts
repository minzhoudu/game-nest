import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * One fetch on mount as a fallback in case the dashboard socket hasn't
 * delivered its snapshot yet (or is blocked by a firewall/proxy) — after
 * that, useDashboardSocket() keeps this query's cache current via
 * node.connected/node.disconnected events. No polling.
 */
export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: api.listNodes,
    staleTime: Infinity,
  });
}
