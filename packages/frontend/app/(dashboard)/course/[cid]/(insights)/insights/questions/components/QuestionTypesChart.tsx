import React, { useMemo } from 'react'
import PieChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/PieChartComponent'
import { ChartSize } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import {
  constructChartConfig,
  processChartData,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import { useInsight } from '@/app/hooks/useInsight'
import { BarChartOutputType } from '@koh/common'
import InsightCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightCard'

interface QuestionTypesChartParams {
  courseId: number
  size?: ChartSize
}

const QuestionTypesChart: React.FC<QuestionTypesChartParams> = ({
  courseId,
  size,
}) => {
  const labelKey = 'questionTypeName',
    valueKey = 'totalQuestions'
  const questionTypeBreakdown = useInsight(courseId, 'QuestionTypeBreakdown', {
    start: new Date(0),
    end: new Date(),
  })
  const chartData = useMemo(
    () => (questionTypeBreakdown as BarChartOutputType)?.data,
    [questionTypeBreakdown],
  )

  const processedChartData = useMemo(
    () =>
      chartData != undefined
        ? processChartData(chartData, labelKey, [valueKey], true)
        : undefined,
    [chartData, labelKey, valueKey],
  )

  const chartConfig = useMemo(
    () =>
      processedChartData != undefined
        ? constructChartConfig(processedChartData.data)
        : undefined,
    [processedChartData],
  )

  return (
    questionTypeBreakdown != undefined &&
    chartConfig != undefined &&
    processedChartData != undefined && (
      <InsightCard
        // TODO: remove this after insight output type is adjusted to new reality
        title={(questionTypeBreakdown as any)['title']}
        subtitle={(questionTypeBreakdown as any)['description']}
      >
        <PieChartComponent
          valueKeys={processedChartData.keys}
          chartConfig={chartConfig}
          chartData={processedChartData.data}
          size={size}
        />
      </InsightCard>
    )
  )
}

export default QuestionTypesChart
