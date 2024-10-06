import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  BarChartProps,
  ChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import {
  generateAxisRange,
  generateTickRange,
  generateUniqueColor,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import {
  NameType,
  Payload as TooltipPayload,
} from 'recharts/types/component/DefaultTooltipContent'
import {
  getAxisComponents,
  getLegendAndTooltipComponents,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/ChartFunctions'
import { numToWeekday, StringMap } from '@koh/common'

const BarChartComponent: React.FC<ChartComponentProps> = ({ props }) => {
  const { chartConfig, chartData, size } = props

  let { includeTooltip, tickLine, tickMargin, axisLine } =
    props as BarChartProps

  includeTooltip ??= true
  tickLine ??= true
  tickMargin ??= 8
  axisLine ??= true

  const labelFormatter = (
    label: string,
    payload: TooltipPayload<string, NameType>[],
  ) => {
    if (payload != undefined) {
      const p = (payload as any[])[0]?.payload
      return numToWeekday(p.Weekday) + `  (${tickFormatter(p.key)})`
    } else {
      return label
    }
  }

  const tickFormatter = (label: number) => {
    const hours = Math.floor(label / 60)
    const minutes = Math.floor(label - hours * 60)
    const hourToPm =
      hours > 0 && hours <= 12 ? hours : hours == 0 ? 12 : hours - 12

    return `${hourToPm}:${(minutes < 10 ? '0' : '') + Math.round(minutes)} ${hours == 24 || hours == 0 || hours < 12 ? 'AM' : 'PM'}`
  }

  const valueFormatter = (label: any, key: any, body: any) => {
    if (key == 'key') {
      const payload: any = body.payload
      return 'Questions: ' + payload?.Amount ?? 0
    }
    return undefined
  }

  const className = useMemo(() => {
    return size != undefined && AxisChartClasses[size] != undefined
      ? AxisChartClasses[size]
      : AxisChartClasses['md']
  }, [size])

  const processedChartData = useMemo(
    () =>
      chartData.map((v) => {
        return {
          ...v,
          fill: generateUniqueColor(parseInt(v['Weekday'] ?? '0'), 7),
        }
      }),
    [chartData],
  )

  const timeAxis = useMemo(() => {
    const range = generateAxisRange(processedChartData, ['key'], 60)
    range[0] = range[0] >= 60 ? range[0] - 60 : range[0]
    range[1] = range[1] <= 1380 ? range[1] + 60 : range[1]
    return range
  }, [processedChartData])

  const timeTicks = useMemo(() => generateTickRange(timeAxis, 4), [timeAxis])

  return (
    <ChartContainer
      config={chartConfig}
      className={className}
      style={{ aspectRatio: 3 }}
    >
      <ScatterChart layout={'vertical'} data={processedChartData}>
        <CartesianGrid />
        <XAxis
          type={'number'}
          dataKey={'key'}
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          tickFormatter={tickFormatter}
          ticks={timeTicks}
          domain={timeAxis}
        />
        <YAxis
          type={'number'}
          dataKey={'Weekday'}
          tickFormatter={(label) => numToWeekday(label).substring(0, 3)}
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          ticks={[0, 1, 2, 3, 4, 5, 6]}
          domain={[0, 6]}
        />
        <ZAxis dataKey={'Amount'} range={[32, 256]} />
        {includeTooltip && (
          <ChartTooltip
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
            cursor={true}
            content={<ChartTooltipContent />}
          />
        )}
        <Scatter dataKey={'key'} />
      </ScatterChart>
    </ChartContainer>
  )
}

export default BarChartComponent
