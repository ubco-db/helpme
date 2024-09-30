'use client'

import React from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useParams } from 'next/navigation'
import ChartDemoComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/ChartDemoComponent'
import InsightsPageContainer from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageContainer'
import InsightComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'
export default function InsightsPage() {
  const { cid } = useParams<{ cid: string }>()

  const courseId = parseInt(cid)
  const insights: string[] = [
    'TotalStudents',
    'TotalQuestionsAsked',
    'MedianWaitTime',
    'QuestionTypeBreakdown',
    'MostActiveStudents',
    'QuestionToStudentRatio',
    'MedianHelpingTime',
    'AverageWaitTimeByWeekDay',
    'HelpSeekingOverTime',
    'HumanVsChatbot',
  ]

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
        {insights.map((name, index) => (
          <InsightComponent
            key={index}
            courseId={courseId}
            insightName={name}
          />
        ))}
      </InsightsPageContainer>
    </div>
  )
}
