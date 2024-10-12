import { GanttChartOutputType } from '@koh/common'
import React, { useMemo } from 'react'
import {
  constructChartConfig,
  generateUniqueColor,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import {
  ChartDataType,
  ChartSize,
  gantt_charts,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import InsightCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightCard'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'
import { Empty } from 'antd'
import GanttChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/GanttChartComponent'

const InsightGanttChartComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
  insightName,
  filterContent,
}) => {
  const chartOutput = insight.output as GanttChartOutputType
  const matchingChart = gantt_charts[insightName]

  const chartData = useMemo(
    () => chartOutput.data,
    [chartOutput.data, chartOutput.xKey, matchingChart],
  )

  const chartRender = useMemo(() => {
    if (matchingChart) {
      const data: ChartDataType[] = chartOutput.data.map((v) => {
        return {
          key: v[chartOutput.xKey],
          [chartOutput.yKey]: v[chartOutput.yKey],
          [chartOutput.zKey]: v[chartOutput.zKey],
          fill: generateUniqueColor(
            parseInt(v[chartOutput.yKey] ?? '0'),
            Math.max(...chartOutput.data.map((v) => v[chartOutput.yKey])),
          ),
        } as ChartDataType
      })

      const chartConfig = constructChartConfig(data, chartOutput.label)

      const props = {
        chartData: data,
        chartConfig,
        xKey: 'key',
        yKey: chartOutput.yKey,
        zKey: chartOutput.zKey,
        size: 'md' as ChartSize,
        ...matchingChart.props,
      }

      return <GanttChartComponent props={props} />
    }
  }, [
    chartData,
    chartOutput.label,
    chartOutput.xKey,
    chartOutput.yKey,
    chartOutput.xKey,
    matchingChart,
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
