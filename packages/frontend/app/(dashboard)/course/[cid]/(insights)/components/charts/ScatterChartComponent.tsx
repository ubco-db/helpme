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
  AxisChartProps,
  ChartComponentProps,
  PointChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'
import { generateAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/utils/functions'

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
        {(xType == 'numeric' && (
          <XAxis
            type={'number'}
            dataKey={'key'}
            tickLine={tickLine}
            tickMargin={tickMargin}
            axisLine={axisLine}
            tickFormatter={tickFormatter}
            domain={generateAxisRange(chartData, ['key'])}
          />
        )) || (
          <XAxis
            dataKey="key"
            tickLine={tickLine}
            tickMargin={tickMargin}
            axisLine={axisLine}
            tickFormatter={tickFormatter}
          />
        )}
        {(yType == 'category' && (
          <YAxis
            tickLine={tickLine}
            tickMargin={tickMargin}
            axisLine={axisLine}
            hide={!verticalAxis}
          />
        )) || (
          <YAxis
            type="number"
            domain={generateAxisRange(chartData, valueKeys)}
            tickLine={tickLine}
            tickMargin={tickMargin}
            axisLine={axisLine}
            hide={!verticalAxis}
          />
        )}
        {includeTooltip && (
          <ChartTooltip
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
            cursor={false}
            content={<ChartTooltipContent />}
          />
        )}
        {includeLegend && (
          <ChartLegend
            formatter={legendFormatter}
            content={<ChartLegendContent />}
          />
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
