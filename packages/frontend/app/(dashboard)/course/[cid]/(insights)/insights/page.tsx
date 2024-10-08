'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useParams } from 'next/navigation'
import InsightComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'
import InsightsPageMenu from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageMenu'
import { InsightContextProvider } from '@/app/(dashboard)/course/[cid]/(insights)/insights/context/InsightsContext'
import {
  InsightCategory,
  InsightDashboardPartial,
  InsightDetail,
  InsightDirectory,
  InsightSerial,
  InsightType,
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

  const renderInsights = useCallback(
    (categories: InsightDetail, dashboard?: boolean) => {
      const validInsights = dashboard
        ? Object.keys(categories).filter(
            (v) => dashboardInsights?.insights[v].active == true,
          )
        : Object.keys(categories).filter(
            (v) => InsightDirectory[v].category == category,
          )

      const mappedInsights: { name: string; insight: InsightSerial }[] =
        validInsights.map((v) => {
          return {
            name: v,
            insight: InsightDirectory[v],
          }
        })

      const valueClusters: React.ReactNode[] = []
      const valueOnly = mappedInsights.filter(
        (v) => v.insight.type == InsightType.Value,
      )
      while (valueOnly.length > 0) {
        const values = [valueOnly.pop(), valueOnly.pop(), valueOnly.pop()]
        valueClusters.push(
          <div className={'flex flex-auto flex-col gap-4'}>
            {values.map((v, index) =>
              v != undefined ? (
                <InsightComponent
                  key={'v' + index}
                  courseId={courseId}
                  insightName={v.name}
                />
              ) : undefined,
            )}
          </div>,
        )
      }

      const insightRenders: React.ReactNode[] = mappedInsights
        .filter((v) => v.insight.type != InsightType.Value)
        .map((v, index) => (
          <InsightComponent
            key={index}
            courseId={courseId}
            insightName={v.name}
          />
        ))

      switch (insightRenders.length) {
        case 0:
        case 1:
        case 2:
          return insightRenders.concat(...valueClusters)
        default:
          const renders: React.ReactNode[] = []
          while (insightRenders.length > 0 || valueClusters.length > 0) {
            renders.push(
              ...[
                insightRenders.pop(),
                insightRenders.pop(),
                valueClusters.pop(),
              ],
            )
          }
          return renders
      }
    },
    [category, selectedDashboard, dashboardInsights],
  )

  return (
    <>
      <InsightsPageMenu category={category} setCategory={setCategory} />
      <InsightContextProvider courseId={courseId}>
        <div className="flex-1">
          {category == 'Dashboard' && (
            <DashboardPresetComponent
              courseId={courseId}
              allPresets={allPresets}
              setAllPresets={setAllPresets}
              selectedDashboard={selectedDashboard}
              setSelectedDashboard={setSelectedDashboard}
            />
          )}
          <div
            className={'flex flex-1 p-5'}
            style={{
              paddingTop: category == 'Dashboard' ? '2.25rem' : undefined,
            }}
          >
            <div className={'flex flex-1 flex-row flex-wrap gap-4'}>
              {category == 'Dashboard' ? (
                <>
                  {(dashboardInsights != undefined &&
                    Object.keys(dashboardInsights.insights).length > 0 &&
                    renderInsights(dashboardInsights.insights, true)) || (
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
                renderInsights(InsightDirectory)
              )}
            </div>
          </div>
        </div>
      </InsightContextProvider>
    </>
  )
}
