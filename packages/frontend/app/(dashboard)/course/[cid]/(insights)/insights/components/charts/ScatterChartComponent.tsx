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
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

interface ScatterChartProps extends AxisChartProps {
  fullFill?: boolean
}

const ScatterChartComponent: React.FC<ScatterChartProps> = ({
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
  fullFill,
}) => {
  fullFill ??= true
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
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        )}
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key) => (
            <Scatter
              key={key}
              stroke={!fullFill ? valueFills[key] : 'transparent'}
              fill={fullFill ? valueFills[key] : 'transparent'}
              dataKey={key}
            />
          ))}
      </ScatterChart>
    </ChartContainer>
  )
}

export default ScatterChartComponent
