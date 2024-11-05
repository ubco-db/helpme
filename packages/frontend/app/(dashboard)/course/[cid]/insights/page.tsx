'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useParams } from 'next/navigation'
import InsightComponent from '@/app/(dashboard)/course/[cid]/insights/components/outputComponents/InsightComponent'
import InsightsPageMenu from '@/app/(dashboard)/course/[cid]/insights/components/InsightsPageMenu'
import { InsightContextProvider } from '@/app/(dashboard)/course/[cid]/insights/context/InsightsContext'
import {
  InsightCategory,
  InsightDashboardPartial,
  InsightDetail,
  InsightDisplayInfo,
  InsightType,
  ListInsightsResponse,
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

  const [insightDirectory, setInsightDirectory] = useState<
    ListInsightsResponse | undefined
  >(undefined)
  useEffect(() => {
    API.insights.list().then((result) => {
      if (result != undefined) {
        setInsightDirectory(result)
      }
    })
  }, [])

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
    (categories?: InsightDetail) => {
      if (insightDirectory == undefined) {
        return null
      }

      const validInsights = categories
        ? Object.keys(insightDirectory).filter(
            (v) => dashboardInsights?.insights[v].active == true,
          )
        : Object.keys(insightDirectory).filter(
            (v) => insightDirectory[v].insightCategory == category,
          )

      const mappedInsights: { name: string; insight: InsightDisplayInfo }[] =
        validInsights.map((v) => {
          return {
            name: v,
            insight: insightDirectory[v],
          }
        })

      const valueClusters: React.ReactNode[] = []
      const valueOnly = mappedInsights.filter(
        (v) => v.insight.insightType == InsightType.Value,
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
        .filter((v) => v.insight.insightType != InsightType.Value)
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
    [category, dashboardInsights, courseId, insightDirectory],
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
              insightDirectory={insightDirectory}
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
                    renderInsights(dashboardInsights.insights)) || (
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
                renderInsights()
              )}
            </div>
          </div>
        </div>
      </InsightContextProvider>
    </>
  )
}
