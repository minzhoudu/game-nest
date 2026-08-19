import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: api.listTemplates,
    staleTime: Infinity,
  });
}
