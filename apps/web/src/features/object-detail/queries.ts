import { queryOptions } from '@tanstack/react-query';
import { getObjectDetail } from '../../lib/api/objects';
import { queryKeys } from '../query/keys';

export const objectDetailQueryOptions = (objectId: string) =>
  queryOptions({
    queryKey: queryKeys.objectDetail(objectId),
    queryFn: () => getObjectDetail(objectId),
    staleTime: 30_000,
  });
