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

const ScatterChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const {
    chartConfig,
    chartData,
    size,
    valueKeys,
    valueFills,
    labelFormatter,
    valueFormatter,
  } = props

  let {
    includeLegend,
    includeTooltip,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
    fullPointFill,
  } = props as PointChartProps

  fullPointFill ??= true
  includeLegend ??= true
  includeTooltip ??= true
  verticalAxis ??= true
  tickLine ??= true
  tickMargin ??= 8
  axisLine ??= true

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <ScatterChart data={chartData}>
        <CartesianGrid vertical={verticalAxis} />
        <XAxis
          dataKey="key"
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          tickFormatter={(value) => (value as string).substring(0, 3)}
        />
        {verticalAxis && (
          <YAxis
            tickLine={tickLine}
            tickMargin={tickMargin}
            axisLine={axisLine}
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
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key) => (
            <Scatter
              key={key}
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
