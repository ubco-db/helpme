import { API } from '@/app/api'
import { InsightOutput, InsightParamsType } from '@koh/common'
import { useMemo } from 'react'

export function useInsight(
  courseId: number,
  insightName: string,
  params?: InsightParamsType,
): Promise<InsightOutput> {
  return useMemo(async () => {
    return await API.insights.get(courseId, insightName, {
      start: params?.start ?? '',
      end: params?.end ?? '',
      offset: params?.offset ?? 0,
      limit: params?.offset ?? 50,
      students: params?.students,
      queues: params?.queues,
    })
  }, [
    courseId,
    insightName,
    params?.end,
    params?.offset,
    params?.start,
    params?.students,
    params?.queues,
  ])
}
