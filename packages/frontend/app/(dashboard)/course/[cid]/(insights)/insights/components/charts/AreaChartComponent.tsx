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
  ChartComponentProps,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { generateAxisRange } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'

const AreaChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
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
    axisRatio,
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
  axisRatio ??= 2
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
      style={{ aspectRatio: axisRatio }}
    >
      <AreaChart data={chartData} accessibilityLayer>
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
        <YAxis
          type="number"
          domain={generateAxisRange(chartData, valueKeys)}
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
                    stopOpacity={0.0}
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
              strokeWidth={2}
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
