'use client'

import React, { useEffect, useMemo, useState } from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useParams } from 'next/navigation'
import InsightComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'
import InsightsPageMenu from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageMenu'
import { InsightContextProvider } from '@/app/(dashboard)/course/[cid]/(insights)/insights/context/InsightsContext'
import {
  InsightCategory,
  InsightDashboardPartial,
  InsightDirectory,
} from '@koh/common'
import { API } from '@/app/api'

export default function InsightsPage() {
  const { cid } = useParams<{ cid: string }>()
  const courseId = useMemo(() => parseInt(cid), [cid])
  const [category, setCategory] = useState<InsightCategory>('Dashboard')

  const [allPresets, setAllPresets] = useState<InsightDashboardPartial[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState<
    string | undefined
  >(undefined)

  useEffect(() => {
    API.insights
      .getPresets(courseId)
      .then((result: InsightDashboardPartial[]) => {
        setAllPresets(result ?? [])
        if (result?.length > 0) {
          setSelectedDashboard(result[0].name)
        }
      })
  }, [courseId])

  const dashboardInsights = useMemo(
    () => allPresets.find((p) => p.name == selectedDashboard),
    [selectedDashboard, allPresets],
  )

  return (
    <>
      <InsightsPageMenu category={category} setCategory={setCategory} />
      <InsightContextProvider courseId={courseId}>
        <div className="flex-1 p-5">
          {category == 'Dashboard' && (
            <DashboardPresetComponent
              courseId={courseId}
              allPresets={allPresets}
              setAllPresets={setAllPresets}
              selectedDashboard={selectedDashboard}
              setSelectedDashboard={setSelectedDashboard}
            />
          )}
          <div className={'flex flex-row flex-wrap gap-4'}>
            {category == 'Dashboard' ? (
              <>
                {(dashboardInsights != undefined &&
                  Object.keys(dashboardInsights.insights).length > 0 &&
                  Object.keys(dashboardInsights.insights).map((key, index) =>
                    dashboardInsights.insights[key].active ? (
                      <InsightComponent
                        key={index}
                        courseId={courseId}
                        insightName={key}
                      />
                    ) : undefined,
                  )) || (
                  <div className={'h-full w-full text-center'}>
                    <h2>No insights to show!</h2>
                    <p>
                      Create an insight dashboard preset to view available
                      analytics.
                    </p>
                  </div>
                )}
              </>
            ) : (
              Object.keys(InsightDirectory)
                .filter((v) => InsightDirectory[v].category == category)
                .map((name, index) => (
                  <InsightComponent
                    key={index}
                    courseId={courseId}
                    insightName={name}
                  />
                ))
            )}
          </div>
        </div>
      </InsightContextProvider>
    </>
  )
}
