import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  ChartComponentProps,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { generateYAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'

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
  } = props

  let {
    includeLegend,
    includeTooltip,
    curveType,
    showPoints,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
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
  tickFormatter ??= (value) => (value as string).substring(0, 3)

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <LineChart data={chartData}>
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
            <Line
              key={key}
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
