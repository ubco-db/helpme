import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  AxisChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

interface BarChartProps extends AxisChartProps {
  stackData?: boolean
}

const BarChartComponent: React.FC<BarChartProps> = ({
  chartConfig,
  chartData,
  size,
  includeLegend,
  includeTooltip,
  valueKeys,
  valueFills,
  verticalAxis,
  tickLine,
  tickMargin,
  axisLine,
  stackData,
}) => {
  includeLegend ??= true
  includeTooltip ??= true
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
      <BarChart data={chartData}>
        <CartesianGrid vertical={verticalAxis} />
        <XAxis
          dataKey="key"
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
        />
        {includeTooltip && (
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        )}
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
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
