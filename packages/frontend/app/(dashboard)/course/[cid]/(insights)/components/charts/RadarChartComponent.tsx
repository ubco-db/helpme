import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import React, { useMemo } from 'react'
import {
  ChartComponentProps,
  PointChartProps,
  RadialChartClasses,
} from '@/app/(dashboard)/course/[cid]/(insights)/utils/types'

const RadarChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
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

  let { includeLegend, includeTooltip, showPoints } = props as PointChartProps

  showPoints ??= false
  includeLegend ??= true
  includeTooltip ??= true

  const className = useMemo(() => {
    return size != undefined && RadialChartClasses[size] != undefined
      ? RadialChartClasses[size]
      : RadialChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RadarChart data={chartData}>
        <PolarAngleAxis dataKey={'key'} />
        <PolarGrid />
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
            content={<ChartLegendContent nameKey={'key'} />}
          />
        )}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key, index) => (
            <Radar
              key={index}
              fill={valueFills[key]}
              fillOpacity={0.5}
              dataKey={key}
              dot={showPoints ? { r: 4, fillOpacity: 1 } : undefined}
            />
          ))}
      </RadarChart>
    </ChartContainer>
  )
}

export default RadarChartComponent
