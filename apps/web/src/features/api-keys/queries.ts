import { queryOptions } from '@tanstack/react-query';
import { listApiKeyProviders } from '../../lib/api/api-keys';
import { queryKeys } from '../query/keys';

export const apiKeyProvidersQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.apiKeyProviders(),
    queryFn: () => listApiKeyProviders(),
    staleTime: 3_000,
  });
