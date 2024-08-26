import { API } from '@/app/api'
import { GetOrganizationResponse } from '@koh/common'
import useSWR, { SWRResponse } from 'swr'

type OrganizationResponse = SWRResponse<GetOrganizationResponse, any>

interface UseOrganizationReturn {
  organization?: OrganizationResponse['data']
  organizationError: OrganizationResponse['error']
  mutateOrganization: OrganizationResponse['mutate']
}

export function useOrganization(organizationId: number): UseOrganizationReturn {
  const {
    data: organization,
    error: organizationError,
    mutate: mutateOrganization,
  } = useSWR<GetOrganizationResponse>(
    organizationId ? `/api/v1/organizations/${organizationId}` : null,
    () => API.organizations.get(organizationId),
  )

  return {
    organization,
    organizationError,
    mutateOrganization,
  }
}
