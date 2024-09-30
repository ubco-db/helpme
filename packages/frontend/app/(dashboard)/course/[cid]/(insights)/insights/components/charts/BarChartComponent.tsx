import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  BarChartProps,
  ChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { generateYAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'

const BarChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const {
    chartConfig,
    chartData,
    size,
    valueKeys,
    valueFills,
    labelFormatter,
    valueFormatter,
    legendFormatter,
  } = props

  const { verticalAxis, stackData } = props as BarChartProps

  let {
    includeLegend,
    includeTooltip,
    tickLine,
    tickMargin,
    axisLine,
    tickFormatter,
  } = props as BarChartProps

  includeLegend ??= true
  includeTooltip ??= true
  tickLine ??= true
  tickMargin ??= 8
  axisLine ??= true
  tickFormatter ??= (value) => (value as string).substring(0, 3)

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart data={chartData}>
        <CartesianGrid vertical={verticalAxis} />
        <XAxis
          dataKey="key"
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          tickFormatter={tickFormatter}
        />
        <YAxis
          type="number"
          domain={generateYAxisRange(chartData, valueKeys)}
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          hide={!verticalAxis}
        />
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
          valueKeys.map((key) => (
            <Bar
              key={key}
              stackId={stackData ? '0' : undefined}
              fill={valueFills[key]}
              dataKey={key}
            />
          ))}
      </BarChart>
    </ChartContainer>
  )
}

export default BarChartComponent
