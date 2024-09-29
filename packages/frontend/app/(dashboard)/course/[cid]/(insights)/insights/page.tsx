'use client'

import React, { useMemo } from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useInsight } from '@/app/hooks/useInsight'
import { useParams } from 'next/navigation'
import ChartDemoComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/ChartDemoComponent'
import InsightsPageContainer from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageContainer'
import TableCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/TableCard'
import GlanceCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/GlanceCard'
import {
  ChartOutputType,
  InsightOutput,
  InsightType,
  TableOutputType,
} from '@koh/common'
import InsightCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightCard'
import InsightChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightChartComponent'

export default function InsightsPage() {
  const { cid } = useParams<{ cid: string }>()

  const courseId = parseInt(cid)
  const insights: { [key: string]: InsightOutput | undefined } = {
    TotalStudents: useInsight(courseId, 'TotalStudents', {
      start: new Date(0),
      end: new Date(),
    }),
    TotalQuestionsAsked: useInsight(courseId, 'TotalQuestionsAsked', {
      start: new Date(0),
      end: new Date(),
    }),
    MedianWaitTime: useInsight(parseInt(cid), 'MedianWaitTime', {
      start: new Date(0),
      end: new Date(),
    }),
    QuestionTypeBreakdown: useInsight(parseInt(cid), 'QuestionTypeBreakdown', {
      start: new Date(0),
      end: new Date(),
    }),
    MostActiveStudents: useInsight(parseInt(cid), 'MostActiveStudents', {
      start: new Date(0),
      end: new Date(),
    }),
    QuestionToStudentRatio: useInsight(
      parseInt(cid),
      'QuestionToStudentRatio',
      { start: new Date(0), end: new Date() },
    ),
    MedianHelpingTime: useInsight(parseInt(cid), 'MedianHelpingTime', {
      start: new Date(0),
      end: new Date(),
    }),
    AverageWaitTimeByWeekDay: useInsight(
      parseInt(cid),
      'AverageWaitTimeByWeekDay',
      {
        start: new Date(0),
        end: new Date(),
      },
    ),
    HelpSeekingOverTime: useInsight(parseInt(cid), 'HelpSeekingOverTime', {
      start: new Date(0),
      end: new Date(),
    }),
    HumanVsChatbot: useInsight(parseInt(cid), 'HumanVsChatbot', {
      start: new Date(0),
      end: new Date(),
    }),
  }

  const insightComponents = () => {
    return Object.keys(insights).map((key) => {
      const insight = insights[key]
      if (insight != undefined) {
        switch (insight.outputType) {
          case InsightType.Value:
            return (
              <GlanceCard
                key={key}
                title={insight.title}
                description={insight.description}
              >
                {insight.output as string}
              </GlanceCard>
            )
          case InsightType.Table:
            return (
              <TableCard
                key={key}
                title={insight.title}
                description={insight.description}
                tableData={insight.output as TableOutputType}
              />
            )
          case InsightType.Chart:
            return (
              <InsightCard
                key={key}
                title={insight.title}
                description={insight.description}
              >
                <InsightChartComponent
                  key={'chart-' + key}
                  insightName={key}
                  chartOutput={insight.output as ChartOutputType}
                />
              </InsightCard>
            )
        }
      }
    })
  }

  return (
    <div>
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
      </div>
      <DashboardPresetComponent />
      <InsightsPageContainer>
        <ChartDemoComponent />
        {insightComponents()}
      </InsightsPageContainer>
    </div>
  )
}
