import { XAxis, YAxis } from 'recharts'
import { ChartDataType } from '@/app/(dashboard)/course/[cid]/insights/utils/types'
import { generateAxisRange } from '@/app/(dashboard)/course/[cid]/insights/utils/functions'
import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import {
  Formatter as TooltipFormatter,
  Payload as TooltipPayload,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'
import { Formatter } from 'recharts/types/component/DefaultLegendContent'

export function getAxisComponents(
  chartData: ChartDataType[],
  valueKeys: string[],
  tickMargin: number,
  verticalAxis?: boolean,
  tickLine?: boolean,
  axisLine?: boolean,
  tickFormatter?: (value: any, index: number) => string,
  minTickGap?: number,
  angle?: number,
  xType?: 'numeric' | 'category',
  yType?: 'numeric' | 'category',
) {
  return (
    <>
      {(xType == 'numeric' && (
        <XAxis
          type={'number'}
          dataKey={'key'}
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          tickFormatter={tickFormatter}
          domain={generateAxisRange(chartData, ['key'])}
        />
      )) || (
        <XAxis
          dataKey="key"
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          tickFormatter={tickFormatter}
        />
      )}
      {(yType == 'category' && (
        <YAxis
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          hide={!verticalAxis}
        />
      )) || (
        <YAxis
          type="number"
          domain={generateAxisRange(chartData, valueKeys)}
          tickLine={tickLine}
          tickMargin={tickMargin}
          axisLine={axisLine}
          hide={!verticalAxis}
        />
      )}
    </>
  )
}

export function getLegendAndTooltipComponents(
  includeLegend?: boolean,
  includeTooltip?: boolean,
  labelFormatter?: (
    label: any,
    payload: TooltipPayload<any, NameType>[],
  ) => React.ReactNode,
  valueFormatter?: TooltipFormatter<any, NameType>,
  legendFormatter?: Formatter,
) {
  return (
    <>
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
          content={<ChartLegendContent />}
        />
      )}
    </>
  )
}
