import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { LabelList, RadialBar, RadialBarChart } from 'recharts'
import React, { useMemo } from 'react'
import {
  DefaultChartProps,
  RadialChartClasses,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

interface RadialChartProps extends DefaultChartProps {
  showLabels?: boolean
  stackData?: boolean
}

const RadialChartComponent: React.FC<RadialChartProps> = ({
  chartConfig,
  chartData,
  size,
  includeLegend,
  includeTooltip,
  valueKeys,
  valueFills,
  showLabels,
  stackData,
}) => {
  includeLegend ??= true
  includeTooltip ??= true
  showLabels ??= true

  const className = useMemo(() => {
    return size != undefined && RadialChartClasses[size] != undefined
      ? RadialChartClasses[size]
      : RadialChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RadialBarChart
        data={chartData}
        innerRadius={30}
        startAngle={-90}
        endAngle={380}
      >
        {includeTooltip && (
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent nameKey={'key'} />}
          />
        )}
        {includeLegend && (
          <ChartLegend content={<ChartLegendContent nameKey={'key'} />} />
        )}
        {valueKeys &&
          valueFills &&
          valueKeys.map((key) => (
            <RadialBar
              key={key}
              stackId={stackData ? 'radial-stack' : undefined}
              fill={valueFills[key]}
              dataKey={key}
            >
              {showLabels && (
                <LabelList
                  position={'insideStart'}
                  dataKey={'key'}
                  className={'fill-white capitalize mix-blend-luminosity'}
                  fontSize={11}
                />
              )}
            </RadialBar>
          ))}
      </RadialBarChart>
    </ChartContainer>
  )
}

export default RadialChartComponent
