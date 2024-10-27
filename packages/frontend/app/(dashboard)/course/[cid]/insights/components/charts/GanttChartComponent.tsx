import {
  AxisChartClasses,
  ChartDataType,
  GanttChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/insights/utils/types'
import React, { useMemo } from 'react'
import {
  generateAxisRange,
  generateTickRange,
} from '@/app/(dashboard)/course/[cid]/insights/utils/functions'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

const GanttChartComponent: React.FC<GanttChartComponentProps> = ({ props }) => {
  const {
    yKey,
    zKey,
    chartConfig,
    chartData,
    size,
    numCategories,
    aspectRatio,
    yIsCategory,
    yDomain,
  } = props

  let {
    includeTooltip,
    labelFormatter,
    xTickFormatter,
    yTickFormatter,
    valueFormatter,
    xRange,
  } = props

  includeTooltip ??= true
  labelFormatter ??= (label: string) => label
  xTickFormatter ??= (tick: string) => tick
  yTickFormatter ??= (tick: string) => tick
  valueFormatter ??= (value: string) => value
  xRange ??= (chartData: ChartDataType[]) =>
    generateAxisRange(chartData, ['key'], 10)

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  const xAxis = useMemo(() => xRange(chartData), [chartData, xRange])

  const xTicks = useMemo(() => generateTickRange(xAxis, 4), [xAxis])
  const yTicks = useMemo(() => {
    const range: number[] = []
    for (let i = -1; i <= numCategories; i++) {
      range.push(i)
    }
    return range
  }, [numCategories])

  const bubbleSizeRange = useMemo(() => {
    switch (size) {
      case '4xl':
      case '3xl':
        return [32, 256]
      case '2xl':
      case 'lg':
        return [32, 128]
      case 'md':
        return [24, 96]
      case 'sm':
        return [16, 64]
      case 'xs':
        return [16, 48]
      case 'xxs':
        return [16, 32]
      default:
        return [24, 96]
    }
  }, [size])

  return (
    <ChartContainer
      config={chartConfig}
      className={className}
      style={{ aspectRatio: aspectRatio ?? 3 }}
    >
      <ScatterChart layout={'vertical'} data={chartData}>
        <CartesianGrid />
        <XAxis
          type={'number'}
          dataKey={'key'}
          tickLine={true}
          tickMargin={8}
          axisLine={true}
          tickFormatter={xTickFormatter}
          ticks={xTicks}
          domain={xAxis}
        />
        <YAxis
          type={yIsCategory ? 'category' : 'number'}
          dataKey={yKey}
          tickFormatter={yTickFormatter}
          tickLine={true}
          tickMargin={4}
          axisLine={true}
          ticks={!yDomain ? yTicks : yDomain}
          domain={!yDomain ? [0, numCategories - 1] : yDomain}
          allowDuplicatedCategory={false}
        />
        {(zKey != undefined && (
          <ZAxis dataKey={zKey} range={bubbleSizeRange} />
        )) || <ZAxis range={[bubbleSizeRange[1], bubbleSizeRange[1] + 1]} />}
        {includeTooltip && (
          <ChartTooltip
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
            cursor={true}
            content={<ChartTooltipContent />}
          />
        )}
        <Scatter
          dataKey={'key'}
          shape={zKey == undefined ? 'square' : undefined}
          radius={zKey != undefined ? 48 : undefined}
        />
      </ScatterChart>
    </ChartContainer>
  )
}

export default GanttChartComponent
