import { ChartContainer } from '@/app/components/ui/chart'
import { Scatter, ScatterChart, CartesianGrid } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  AxisChartProps,
  ChartComponentProps,
  PointChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'
import {
  getAxisComponents,
  getLegendAndTooltipComponents,
} from '@/app/(dashboard)/course/[cid]/(insights)/components/charts/ChartFunctions'

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

  const { minTickGap, angle } = props as AxisChartProps

  let {
    includeLegend,
    includeTooltip,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
    aspectRatio,
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
