import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

const AreaChartComponent: React.FC<LinearChartProps> = ({
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
      <AreaChart data={chartData} accessibilityLayer>
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
        <defs>
          {valueKeys &&
            valueFills &&
            valueKeys.map((key) => (
              <>
                <linearGradient id={'fill' + key} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset={'5%'}
                    stopColor={valueFills[key]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset={'95%'}
                    stopColor={valueFills[key]}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </>
            ))}
        </defs>
        {valueKeys &&
          valueFills &&
          valueKeys.map((key) => (
            <Area
              key={key}
              stroke={valueFills[key]}
              strokeWidth={3}
              fill={`url(#fill${key})`}
              dataKey={key}
              dot={showPoints}
              type={curveType ?? 'monotone'}
            />
          ))}
      </AreaChart>
    </ChartContainer>
  )
}

export default AreaChartComponent
