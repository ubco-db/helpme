'use client'

import React from 'react'
import DashboardPresetComponent from '../insights/components/DashboardPresetComponent'
import { useInsight } from '@/app/hooks/useInsight'
import { useParams } from 'next/navigation'
import ChartDemoComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/ChartDemoComponent'
import InsightsPageContainer from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightsPageContainer'
import TableCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/TableCard'
import GlanceCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/GlanceCard'
import { SimpleTableOutputType } from '@koh/common'
import QuestionTypesChart from '@/app/(dashboard)/course/[cid]/(insights)/insights/questions/components/QuestionTypesChart'

export default function InsightsPage() {
  const { cid } = useParams<{ cid: string }>()

  const courseId = parseInt(cid)
  const insights = {
    totalStudents: useInsight(courseId, 'TotalStudents', {
      start: new Date(0),
      end: new Date(),
    }),
    totalQuestionsAsked: useInsight(courseId, 'TotalQuestionsAsked', {
      start: new Date(0),
      end: new Date(),
    }),
    medianWaitTime: useInsight(parseInt(cid), 'MedianWaitTime', {
      start: new Date(0),
      end: new Date(),
    }),
    questionTypes: useInsight(parseInt(cid), 'QuestionTypeBreakdown', {
      start: new Date(0),
      end: new Date(),
    }),
    mostActiveStudents: useInsight(parseInt(cid), 'MostActiveStudents', {
      start: new Date(0),
      end: new Date(),
    }),
    questionToStudentRatio: useInsight(
      parseInt(cid),
      'QuestionToStudentRatio',
      { start: new Date(0), end: new Date() },
    ),
    medianHelpingTime: useInsight(parseInt(cid), 'MedianHelpingTime', {
      start: new Date(0),
      end: new Date(),
    }),
  }

  console.log(insights)

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
        <GlanceCard
          title={'Total Students'}
          description={insights.totalStudents as string}
        />
        <GlanceCard
          title={'Question to Student Ratio'}
          description={insights.questionToStudentRatio as string}
        />
        <GlanceCard
          title={'Total Questions Asked'}
          description={insights.totalQuestionsAsked as string}
        />
        <GlanceCard
          title={'Median Wait Time'}
          description={insights.medianWaitTime as string}
        />
        <GlanceCard
          title={'Median Helping Time'}
          description={insights.medianHelpingTime as string}
        />
        {insights.mostActiveStudents != undefined && (
          <TableCard
            title={'Most Active Students'}
            description={''}
            tableData={(
              insights.mostActiveStudents as SimpleTableOutputType
            ).dataSource.map((data) => {
              return {
                Student: `${data.name} (${data.email})`,
                'Student ID': data.studentId,
                'Questions Asked': data.questionsAsked,
              }
            })}
          />
        )}
        <QuestionTypesChart courseId={parseInt(cid)} size={'xs'} />
        <ChartDemoComponent />
      </InsightsPageContainer>
    </div>
  )
}
