'use client'

import React, { useEffect, useMemo, useState } from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useParams } from 'next/navigation'
import ChartDemoComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/ChartDemoComponent'
import InsightsPageContainer from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageContainer'
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
      .then((result: InsightDashboardPartial[]) => setAllPresets(result ?? []))
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
          <InsightsPageContainer>
            {category == 'Dashboard' ? (
              <>
                <div className={'my-8'}>
                  <pre>
                    {`         __
     _(\\    |@@|
    (__/\\__ \\--/ __
       \\___|----|  |   __
           \\ }{ /\\ )_ / _\\
           /\\__/\\ \\__O (__
          (--/\\--)    \\__/
          _)(  )(_
         \`---''---\` 
         
          Page work ahead? I SURE HOPE IT DOES!`}
                  </pre>
                  <ChartDemoComponent />
                  {dashboardInsights != undefined &&
                    Object.keys(dashboardInsights.insights).map((key, index) =>
                      dashboardInsights.insights[key].active ? (
                        <InsightComponent
                          key={index}
                          courseId={courseId}
                          insightName={key}
                        />
                      ) : undefined,
                    )}
                </div>
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
          </InsightsPageContainer>
        </div>
      </InsightContextProvider>
    </>
  )
}
