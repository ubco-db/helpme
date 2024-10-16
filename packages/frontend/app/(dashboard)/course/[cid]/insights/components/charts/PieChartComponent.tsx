import {
  ChartComponentProps,
  RadialChartClasses,
  RadialChartProps,
} from '@/app/(dashboard)/course/[cid]/insights/utils/types'
import React, { useMemo } from 'react'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { LabelList, Pie, PieChart } from 'recharts'

const PieChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const {
    valueKeys,
    chartConfig,
    chartData,
    size,
    labelFormatter,
    valueFormatter,
    legendFormatter,
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
          <ChartLegend
            formatter={legendFormatter}
            content={<ChartLegendContent nameKey={'key'} />}
          />
        )}
        {valueKeys &&
          valueKeys.map((key, index) => (
            <Pie
              key={index}
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
                    labelFormatter
                      ? labelFormatter(chartConfig[value]?.label + '', [])
                      : chartConfig[value]?.label + ''
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
