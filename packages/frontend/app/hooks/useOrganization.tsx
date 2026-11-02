import { API } from '@/app/api';
import type { GetOrganizationResponse } from '@koh/common';
import type { SWRResponse } from 'swr';
import useSWR from 'swr';

type OrganizationResponse = SWRResponse<GetOrganizationResponse, any>;

interface UseOrganizationReturn {
  organization?: OrganizationResponse['data'];
  organizationError: OrganizationResponse['error'];
  mutateOrganization: OrganizationResponse['mutate'];
}

export function useOrganization(organizationId: number): UseOrganizationReturn {
  const {
    data: organization,
    error: organizationError,
    mutate: mutateOrganization,
  } = useSWR<GetOrganizationResponse>(
    organizationId ? `/api/v1/organizations/${organizationId}` : null,
    () => API.organizations.get(organizationId),
  );

  return {
    organization,
    organizationError,
    mutateOrganization,
  };
}
