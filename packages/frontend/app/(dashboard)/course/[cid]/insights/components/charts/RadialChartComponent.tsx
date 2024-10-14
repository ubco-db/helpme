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
  RadialChartProps,
  RadialChartClasses,
  ChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/insights/utils/types'

const RadialChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
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

  const { stackData } = props as RadialChartProps

  let { includeLegend, includeTooltip, showLabels } = props as RadialChartProps

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
            <RadialBar
              key={index}
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
