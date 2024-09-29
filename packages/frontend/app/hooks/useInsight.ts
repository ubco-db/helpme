import useSWR from 'swr'
import { API } from '@/app/api'

export function useInsight(
  courseId: number,
  insightName: string,
  dates?: { start?: Date; end?: Date },
  limit?: number,
  offset?: number,
) {
  const key = `api/v1/insights/${courseId}/${insightName}`

  const { data: insightData } = useSWR(key, async () => {
    if (isNaN(courseId)) {
      return undefined
    }
    return await API.insights.get(courseId, insightName, {
      start: dates?.start?.toDateString() ?? '',
      end: dates?.end?.toDateString() ?? '',
      limit: limit ?? 100,
      offset: offset ?? 0,
    })
  })

  return insightData
}
