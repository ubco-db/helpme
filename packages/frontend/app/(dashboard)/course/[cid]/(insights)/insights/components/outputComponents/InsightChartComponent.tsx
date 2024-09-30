import { ChartOutputType } from '@koh/common'
import React, { useMemo } from 'react'
import AreaChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/AreaChartComponent'
import BarChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/BarChartComponent'
import LineChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/LineChartComponent'
import PieChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/PieChartComponent'
import RadarChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/RadarChartComponent'
import RadialChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/RadialChartComponent'
import ScatterChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/ScatterChartComponent'
import {
  constructChartConfig,
  processChartData,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import { charts } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import InsightCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightCard'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'
import { Empty } from 'antd'

const InsightChartComponent: React.FC<
  GenericInsightComponentProps & { selectedDataSets: string[] }
> = ({ insight, insightName, filterContent, selectedDataSets }) => {
  const chartOutput = insight.output as ChartOutputType
  const matchingChart = charts[insightName]

  const chartData = useMemo(
    () =>
      matchingChart && matchingChart.categoryKeys
        ? chartOutput.data.filter((d) =>
            selectedDataSets.includes(d[chartOutput.xKey]),
          )
        : chartOutput.data,
    [chartOutput.data, chartOutput.xKey, matchingChart, selectedDataSets],
  )

  const chartRender = useMemo(() => {
    if (matchingChart) {
      const { data, keys, fills } = processChartData(
        chartData,
        chartOutput.xKey,
        !matchingChart.categoryKeys
          ? selectedDataSets ?? chartOutput.yKeys
          : chartOutput.yKeys,
        matchingChart.categoryKeys,
      )

      const chartConfig = !matchingChart.categoryKeys
        ? constructChartConfig(data, chartOutput.label, keys, fills)
        : constructChartConfig(data, chartOutput.label)

      const props = {
        chartData: data,
        chartConfig,
        valueKeys: keys,
        valueFills: fills,
        ...matchingChart.props,
      }
      switch (matchingChart.chartType) {
        case 'Area':
          return <AreaChartComponent props={props} />
        case 'Bar':
          return <BarChartComponent props={props} />
        case 'Line':
          return <LineChartComponent props={props} />
        case 'Pie':
          return <PieChartComponent props={props} />
        case 'Radar':
          return <RadarChartComponent props={props} />
        case 'Radial':
          return <RadialChartComponent props={props} />
        case 'Scatter':
          return <ScatterChartComponent props={props} />
        default:
          return <></>
      }
    }
  }, [
    chartData,
    chartOutput.label,
    chartOutput.xKey,
    chartOutput.yKeys,
    matchingChart,
    selectedDataSets,
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

export default InsightChartComponent
