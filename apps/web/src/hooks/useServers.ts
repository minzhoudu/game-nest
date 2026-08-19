import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * One fetch as a fallback (e.g. a direct link to /servers/:id before the
 * dashboard socket has connected); useDashboardSocket() keeps this current
 * after that via server.created/status/removed events. Shared query key
 * with ServersPage, so navigating straight to a detail/logs page still
 * has data to show without a second round-trip once either has fetched.
 */
export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: api.listServers,
    staleTime: Infinity,
  });
}
