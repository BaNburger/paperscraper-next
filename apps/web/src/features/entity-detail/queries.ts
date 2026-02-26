import { queryOptions } from '@tanstack/react-query';
import { getEntityDetail } from '../../lib/api/entities';
import { queryKeys } from '../query/keys';

export const entityDetailQueryOptions = (entityId: string) =>
  queryOptions({
    queryKey: queryKeys.entityDetail(entityId),
    queryFn: () => getEntityDetail(entityId),
    staleTime: 30_000,
  });
