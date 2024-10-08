import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { Scatter, ScatterChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  ChartComponentProps,
  PointChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { generateAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import {
  getAxisComponents,
  getLegendAndTooltipComponents,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/ChartFunctions'

const ScatterChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
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

  let {
    includeLegend,
    includeTooltip,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
    axisRatio,
    fullPointFill,
    tickFormatter,
  } = props as PointChartProps

  fullPointFill ??= true
  includeLegend ??= true
  includeTooltip ??= true
  verticalAxis ??= true
  tickLine ??= true
  tickMargin ??= 8
  axisLine ??= true
  axisRatio ??= 2
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
      style={{ aspectRatio: axisRatio }}
    >
      <ScatterChart data={chartData}>
        <CartesianGrid vertical={verticalAxis} />
        {getAxisComponents(
          chartData,
          valueKeys,
          tickMargin,
          verticalAxis,
          tickLine,
          axisLine,
          tickFormatter,
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
            <Scatter
              key={index}
              stroke={!fullPointFill ? valueFills[key] : 'transparent'}
              fill={fullPointFill ? valueFills[key] : 'transparent'}
              dataKey={key}
            />
          ))}
      </ScatterChart>
    </ChartContainer>
  )
}

export default ScatterChartComponent
