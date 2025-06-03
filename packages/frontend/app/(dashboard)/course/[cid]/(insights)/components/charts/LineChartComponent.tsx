import {
  AxisChartClasses,
  AxisChartProps,
  ChartComponentProps,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'
import React, { useMemo } from 'react'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { CartesianGrid, LineChart, Line, XAxis, YAxis } from 'recharts'
import { generateAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/utils/functions'

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
    xType,
    yType,
  } = props

  const { minTickGap, angle } = props as AxisChartProps

  let {
    includeLegend,
    includeTooltip,
    curveType,
    showPoints,
    verticalAxis,
    tickLine,
    tickMargin,
    axisLine,
    aspectRatio,
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
      <LineChart data={chartData}>
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
            <Line
              key={index}
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
