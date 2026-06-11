'use server'

import { APIClient } from '@/app/api/index'
import { getAuthTokenString } from '@/app/api/cookie-utils'

export default async function getAPI() {
  const token = await getAuthTokenString()
  return new APIClient(process.env.NEXT_PUBLIC_API_BASE_URL, token)
}
