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
  RadialChartProps,
  RadialChartClasses,
  ChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

const PieChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const {
    valueKeys,
    chartConfig,
    chartData,
    size,
    labelFormatter,
    valueFormatter,
  } = props

  const { showLabels } = props as RadialChartProps

  let { includeLegend, includeTooltip, innerRadius } = props as RadialChartProps

  includeLegend ??= true
  includeTooltip ??= true
  innerRadius ??= 0

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
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
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
              {showLabels && (
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
