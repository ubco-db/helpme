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
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

const LineChartComponent: React.FC<LinearChartProps> = ({
  chartConfig,
  chartData,
  size,
  includeLegend,
  includeTooltip,
  curveType,
  showPoints,
  valueKeys,
  valueFills,
  verticalAxis,
  tickLine,
  tickMargin,
  axisLine,
}) => {
  curveType ??= 'monotone'
  showPoints ??= false
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
      <LineChart data={chartData}>
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
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        )}
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
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
