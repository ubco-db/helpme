import {
  AxisChartClasses,
  AxisChartProps,
  ChartComponentProps,
  LinearChartProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'
import React, { useMemo } from 'react'
import { ChartContainer } from '@/app/components/ui/chart'
import { Area, AreaChart, CartesianGrid } from 'recharts'
import {
  getAxisComponents,
  getLegendAndTooltipComponents,
} from '@/app/(dashboard)/course/[cid]/(insights)/components/charts/ChartFunctions'

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
      <AreaChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={verticalAxis} />
        {getAxisComponents(
          chartData,
          valueKeys,
          tickMargin,
          verticalAxis,
          tickLine,
          axisLine,
          tickFormatter,
          minTickGap,
          angle,
          xType,
          yType,
        )}
        {getLegendAndTooltipComponents(
          includeLegend,
          includeTooltip,
          labelFormatter,
          valueFormatter,
          legendFormatter,
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
          valueKeys.map((key, index) => (
            <Area
              key={index}
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
