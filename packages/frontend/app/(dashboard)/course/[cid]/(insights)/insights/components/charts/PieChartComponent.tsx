import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { LabelList, Pie, PieChart } from 'recharts'
import React, { useMemo } from 'react'
import {
  DefaultChartProps,
  RadialChartClasses,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

interface PieChartProps extends DefaultChartProps {
  innerRadius?: number
  showLabel?: boolean
}

const PieChartComponent: React.FC<PieChartProps> = ({
  valueKeys,
  chartConfig,
  chartData,
  size,
  includeLegend,
  includeTooltip,
  innerRadius,
  showLabel,
}) => {
  includeLegend ??= true
  includeTooltip ??= true

  const className = useMemo(() => {
    return size != undefined && RadialChartClasses[size] != undefined
      ? RadialChartClasses[size]
      : RadialChartClasses['md']
  }, [size])

  return (
    <ChartContainer config={chartConfig} className={className}>
      <PieChart accessibilityLayer>
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
          valueKeys.map((key) => (
            <Pie
              key={key}
              data={chartData}
              dataKey={key}
              innerRadius={innerRadius ?? 0}
            >
              {showLabel && (
                <LabelList
                  dataKey={'key'}
                  className={'fill-background'}
                  fontWeight={'bold'}
                  stroke={'none'}
                  position={'outside'}
                  fontSize={12}
                  formatter={(value: keyof typeof chartConfig) =>
                    (chartConfig[value]?.label + '').substring(0, 3)
                  }
                />
              )}
            </Pie>
          ))}
      </PieChart>
    </ChartContainer>
  )
}

export default PieChartComponent
