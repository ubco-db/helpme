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
  DefaultChartProps,
  RadialChartClasses,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

interface RadarChartProps extends DefaultChartProps {
  showPoints?: boolean
}

const RadarChartComponent: React.FC<RadarChartProps> = ({
  chartConfig,
  chartData,
  size,
  includeLegend,
  includeTooltip,
  valueKeys,
  valueFills,
  showPoints,
}) => {
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
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        )}
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key) => (
            <Radar
              key={key}
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
