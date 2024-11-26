import {
  AxisChartClasses,
  AxisChartProps,
  ChartComponentProps,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'
import React, { useMemo } from 'react'
import { ChartContainer } from '@/app/components/ui/chart'
import { CartesianGrid, LineChart, Line } from 'recharts'
import {
  getAxisComponents,
  getLegendAndTooltipComponents,
} from '@/app/(dashboard)/course/[cid]/(insights)/components/charts/ChartFunctions'

const LineChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const {
    chartConfig,
    chartData,
    size,
    valueKeys,
    valueFills,
    labelFormatter,
    valueFormatter,
    legendFormatter,
    xType,
    yType,
  } = props

  const { minTickGap, angle } = props as AxisChartProps

  let {
    includeLegend,
    includeTooltip,
    curveType,
    showPoints,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
    aspectRatio,
    tickFormatter,
  } = props as LinearChartProps

  curveType ??= 'monotone'
  showPoints ??= false
  includeLegend ??= true
  includeTooltip ??= true
  verticalAxis ??= true
  tickLine ??= true
  tickMargin ??= 8
  axisLine ??= true
  aspectRatio ??= 2
  tickFormatter ??= (value) => (value as string).substring(0, 3)

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  return (
    <ChartContainer
      config={chartConfig}
      className={className}
      style={{ aspectRatio: aspectRatio }}
    >
      <LineChart data={chartData}>
        <CartesianGrid vertical={verticalAxis} />
        {getAxisComponents(
          chartData,
          valueKeys,
          tickMargin,
          verticalAxis,
          tickLine,
          axisLine,
          tickFormatter,
          minTickGap,
          angle,
          xType,
          yType,
        )}
        {getLegendAndTooltipComponents(
          includeLegend,
          includeTooltip,
          labelFormatter,
          valueFormatter,
          legendFormatter,
        )}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key, index) => (
            <Line
              key={index}
              stroke={valueFills[key]}
              dataKey={key}
              dot={showPoints}
              type={curveType ?? 'monotone'}
            />
          ))}
      </LineChart>
    </ChartContainer>
  )
}

export default LineChartComponent
