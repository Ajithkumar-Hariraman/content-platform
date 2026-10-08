import { useEffect, type ReactNode } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
export function PrivacyBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    client.removeQueries({
      predicate: (query: Query) =>
        query.queryKey[0] === 'admin' && query.queryKey[1] !== user?.id,
    });
  }, [client, user?.id]);
  return children;
}
