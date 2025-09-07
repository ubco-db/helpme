'use server'

import { APIClient } from '@/app/api/index'
import { fetchAuthToken } from '@/app/api/cookie-utils'

export default async function getAPI() {
  const token = await fetchAuthToken()
  return new APIClient(process.env.NEXT_PUBLIC_API_BASE_URL, token)
}
