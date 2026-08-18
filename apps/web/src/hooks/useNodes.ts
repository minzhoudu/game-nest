import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const NODES_POLL_MS = 5000;

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: api.listNodes,
    refetchInterval: NODES_POLL_MS,
  });
}
