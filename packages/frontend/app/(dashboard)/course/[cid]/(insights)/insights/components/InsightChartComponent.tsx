import {
  AxisChartProps,
  BarChartProps,
  DefaultChartProps,
  LinearChartProps,
  PointChartProps,
  RadialChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { ChartOutputType, ChartType, StringMap } from '@koh/common'
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

interface InsightChartComponentProps {
  insightName: string
  chartOutput: ChartOutputType
}

const colorPerLabel: string[] = [
  'QuestionTypeBreakdown',
  'AverageWaitTimeByWeekDay',
  'HumanVsChatbotScore',
]

export const charts: {
  [key: string]: {
    chartType: ChartType
    props:
      | Partial<DefaultChartProps>
      | Partial<RadialChartProps>
      | Partial<AxisChartProps>
      | Partial<PointChartProps>
      | Partial<LinearChartProps>
      | Partial<BarChartProps>
  }
} = {
  QuestionTypeBreakdown: {
    chartType: 'Pie',
    props: {
      includeLegend: true,
      includeTooltip: true,
      innerRadius: 0,
      showLabels: false,
      size: 'sm',
    },
  },
  AverageWaitTimeByWeekDay: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label) => label + ' minutes',
    },
  },
  HelpSeekingOverTime: {
    chartType: 'Line',
    props: {
      includeLegend: true,
      includeTooltip: true,
      showPoints: true,
      size: '2xl',
      tickFormatter: (label) =>
        new Date(Date.parse(label.replace(/_/g, ' '))).toLocaleString('en-US', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
      labelFormatter: (label) => label.replace(/_/g, ' '),
    },
  },
  HumanVsChatbot: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label) =>
        parseInt(label) > 1 || parseInt(label) == 0
          ? label + ' answers'
          : label + ' answer',
    },
  },
}

const InsightChartComponent: React.FC<InsightChartComponentProps> = ({
  insightName,
  chartOutput,
}) => {
  const chartRender = useMemo(() => {
    const matchingChart = charts[insightName]

    if (matchingChart) {
      const { data, keys, fills } = processChartData(
        chartOutput.data,
        chartOutput.xKey,
        chartOutput.yKeys,
        colorPerLabel.includes(insightName),
      )

      const chartConfig = !colorPerLabel.includes(insightName)
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
    } else {
      return <></>
    }
  }, [insightName, chartOutput])

  return <>{chartRender}</>
}

export default InsightChartComponent
