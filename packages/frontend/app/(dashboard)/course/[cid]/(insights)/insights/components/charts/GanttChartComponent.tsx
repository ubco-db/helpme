import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import React, { useMemo } from 'react'
import {
  AxisChartClasses,
  GanttChartComponentProps,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import {
  generateAxisRange,
  generateTickRange,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import {
  NameType,
  Payload as TooltipPayload,
} from 'recharts/types/component/DefaultTooltipContent'
import { numToWeekday } from '@koh/common'

const GanttChartComponent: React.FC<GanttChartComponentProps> = ({ props }) => {
  const { yKey, zKey, chartConfig, chartData, size, numCategories } = props

  let { includeTooltip, includeLegend } = props

  includeTooltip ??= true
  includeLegend ??= true

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

  const xAxis = useMemo(() => {
    const range = generateAxisRange(chartData, ['key'], 60)
    range[0] = range[0] >= 60 ? range[0] - 60 : range[0]
    range[1] = range[1] <= 1380 ? range[1] + 60 : range[1]
    return range
  }, [chartData])

  const xTicks = useMemo(() => generateTickRange(xAxis, 4), [xAxis])
  const yTicks = useMemo(() => {
    const range: number[] = []
    for (let i = -1; i <= numCategories; i++) {
      range.push(i)
    }
    return range
  }, [numCategories])

  return (
    <ChartContainer
      config={chartConfig}
      className={className}
      style={{ aspectRatio: 3 }}
    >
      <ScatterChart layout={'vertical'} data={chartData}>
        <CartesianGrid />
        <XAxis
          type={'number'}
          dataKey={'key'}
          tickLine={true}
          tickMargin={8}
          axisLine={true}
          tickFormatter={tickFormatter}
          ticks={xTicks}
          domain={xAxis}
        />
        <YAxis
          type={'number'}
          dataKey={yKey}
          tickFormatter={(label) =>
            yTicks.slice(1, yTicks.length - 1).includes(parseInt(label))
              ? numToWeekday(label).substring(0, 3)
              : ''
          }
          tickLine={true}
          tickMargin={8}
          axisLine={true}
          ticks={yTicks}
          domain={[0, numCategories - 1]}
        />
        <ZAxis dataKey={zKey} range={[32, 256]} />
        {includeTooltip && (
          <ChartTooltip
            formatter={valueFormatter}
            labelFormatter={labelFormatter}
            cursor={true}
            content={<ChartTooltipContent />}
          />
        )}
        {includeLegend && <ChartLegend content={<ChartLegendContent />} />}
        <Scatter dataKey={'key'} />
      </ScatterChart>
    </ChartContainer>
  )
}

export default GanttChartComponent
