import React, { useMemo } from 'react'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/insights/components/outputComponents/InsightComponent'
import { GanttChartOutputType } from '@koh/common'
import {
  ChartDataType,
  ChartSize,
  gantt_charts,
} from '@/app/(dashboard)/course/[cid]/insights/utils/types'
import {
  constructChartConfig,
  generateUniqueColor,
} from '@/app/(dashboard)/course/[cid]/insights/utils/functions'
import GanttChartComponent from '@/app/(dashboard)/course/[cid]/insights/components/charts/GanttChartComponent'
import InsightCard from '@/app/(dashboard)/course/[cid]/insights/components/InsightCard'
import { Empty } from 'antd'

const InsightGanttChartComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
  insightName,
  filterContent,
}) => {
  const chartOutput = insight.output as GanttChartOutputType
  const matchingChart = gantt_charts[insightName]

  const chartData = useMemo(() => chartOutput.data, [chartOutput.data])

  const chartRender = useMemo(() => {
    if (matchingChart) {
      const data: ChartDataType[] = chartData.map((v) => {
        const d = {
          key: v[chartOutput.xKey],
          [chartOutput.yKey]: v[chartOutput.yKey],
          fill: generateUniqueColor(
            parseInt(v[chartOutput.yKey] ?? '0'),
            chartOutput.numCategories,
          ),
        } as ChartDataType

        if (chartOutput.zKey != undefined) {
          d[chartOutput.zKey] = v[chartOutput.zKey]
        }

        return d
      })

      const chartConfig = constructChartConfig(data, chartOutput.yKey)

      const props = {
        chartData: data,
        chartConfig,
        xKey: 'key',
        yKey: chartOutput.yKey,
        zKey: chartOutput.zKey,
        size: 'md' as ChartSize,
        numCategories: chartOutput.numCategories,
        ...matchingChart.props,
      }

      return <GanttChartComponent props={props} />
    }
  }, [
    matchingChart,
    chartData,
    chartOutput.yKey,
    chartOutput.zKey,
    chartOutput.numCategories,
    chartOutput.xKey,
  ])

  return (
    <InsightCard title={insight.title} description={insight.description}>
      {filterContent}
      {chartData.length > 0 ? (
        <div className={'mt-4 p-4'}>{chartRender}</div>
      ) : (
        <div className="mx-auto mt-8 w-full p-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}
    </InsightCard>
  )
}

export default InsightGanttChartComponent
