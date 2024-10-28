import { ChartConfig } from '@/app/components/ui/chart'
import { CurveType } from 'recharts/types/shape/Curve'
import {
  NameType,
  Payload as TooltipPayload,
  Formatter as TooltipFormatter,
} from 'recharts/types/component/DefaultTooltipContent'
import { Formatter } from 'recharts/types/component/DefaultLegendContent'
import { numToWeekday } from '@koh/common'
import {
  generateAxisRange,
  getMinutesToTime,
} from '@/app/(dashboard)/course/[cid]/insights/utils/functions'
export type ChartSize =
  | 'xxs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'

export const AxisChartClasses = {
  xxs: 'mx-auto chart-xxs',
  xs: 'mx-auto chart-xs sm:chart-xxs',
  sm: 'mx-auto chart-sm sm:chart-xxs md:chart-xs',
  md: 'mx-auto chart-md sm:chart-xs md:chart-sm',
  lg: 'mx-auto chart-lg sm:chart-sm md:chart-md',
  xl: 'mx-auto chart-xl sm:chart-md md:chart-lg',
  '2xl': 'mx-auto chart-2xl sm:chart-md md:chart-lg',
  '3xl': 'mx-auto chart-3xl sm:chart-md md:chart-lg',
  '4xl': 'mx-auto chart-4xl sm:chart-md md:chart-lg',
}

export const RadialChartClasses = {
  xxs: 'mx-auto aspect-square chart-xxs',
  xs: 'mx-auto aspect-square chart-xs sm:chart-xxs',
  sm: 'mx-auto aspect-square chart-sm sm:chart-xxs md:chart-xs',
  md: 'mx-auto aspect-square chart-md sm:chart-xs md:chart-sm',
  lg: 'mx-auto aspect-square chart-lg sm:chart-md md:chart-md',
  xl: 'mx-auto aspect-square chart-xl sm:chart-md md:chart-lg',
  '2xl': 'mx-auto aspect-square chart-2xl sm:chart-md md:chart-lg',
  '3xl': 'mx-auto aspect-square chart-3xl sm:chart-md md:chart-lg',
  '4xl': 'mx-auto aspect-square chart-4xl sm:chart-md md:chart-lg',
}

export type ChartComponentProps = {
  props:
    | DefaultChartProps
    | RadialChartProps
    | AxisChartProps
    | StackChartProps
    | BarChartProps
    | PointChartProps
    | LinearChartProps
}

export type GanttChartComponentProps = {
  props: GanttChartProps
}

export interface DefaultChartProps {
  valueKeys: string[]
  chartConfig: ChartConfig
  chartData: ChartDataType[]
  includeLegend?: boolean
  includeTooltip?: boolean
  valueFills?: { [key: string]: string }
  xType?: 'numeric' | 'category'
  yType?: 'numeric' | 'category'
  size?: ChartSize
  labelFormatter?: (
    label: any,
    payload: TooltipPayload<string, NameType>[],
  ) => React.ReactNode
  valueFormatter?: TooltipFormatter<any, NameType>
  legendFormatter?: Formatter
}

export interface StackChartProps extends DefaultChartProps {
  stackData?: boolean
}

export interface RadialChartProps extends StackChartProps {
  innerRadius?: number
  showLabels?: boolean
}

export interface AxisChartProps extends DefaultChartProps {
  verticalAxis?: boolean
  tickLine?: boolean
  tickMargin?: number
  minTickGap?: number
  angle?: number
  axisLine?: boolean
  tickFormatter?: (label: string) => string
  aspectRatio?: number
}

export interface BarChartProps extends AxisChartProps, StackChartProps {}

export interface PointChartProps extends AxisChartProps {
  showPoints?: boolean
  fullPointFill?: boolean
}

export interface LinearChartProps extends PointChartProps {
  curveType?: CurveType
}

export interface GanttChartProps {
  chartConfig: ChartConfig
  chartData: ChartDataType[]
  size: ChartSize
  includeTooltip?: boolean
  xKey: string
  yKey: string
  zKey?: string
  numCategories: number
  labelFormatter?: (
    label: any,
    payload: TooltipPayload<string, NameType>[],
  ) => React.ReactNode
  valueFormatter?: TooltipFormatter<any, NameType>
  xTickFormatter?: (label: string) => string
  yTickFormatter?: (label: string) => string
  xRange?: (chartData: ChartDataType[]) => number[]
  aspectRatio?: number
  yIsCategory?: boolean
  yDomain?: string[]
}

export type ChartDataType = { key: string; fill?: string; [key: string]: any }

export type ChartType =
  | 'Area'
  | 'Bar'
  | 'Line'
  | 'Pie'
  | 'Radar'
  | 'Radial'
  | 'Scatter'

export type ChartComponent = {
  chartType: ChartType
  categoryKeys?: boolean
  allowDataFiltering?: boolean
  props:
    | Partial<DefaultChartProps>
    | Partial<RadialChartProps>
    | Partial<AxisChartProps>
    | Partial<PointChartProps>
    | Partial<LinearChartProps>
    | Partial<BarChartProps>
}

export type GanttChartComponent = {
  props: Partial<GanttChartProps>
}

export const charts: {
  [key: string]: ChartComponent
} = {
  QuestionTypeBreakdown: {
    chartType: 'Pie',
    categoryKeys: true,
    props: {
      includeLegend: true,
      includeTooltip: true,
      innerRadius: 0,
      showLabels: true,
      size: 'lg',
      labelFormatter: (label: string) => label,
    },
  },
  AverageTimesByWeekDay: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label: any) => label + ' minutes',
    },
  },
  HelpSeekingOverTime: {
    chartType: 'Area',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: '4xl',
      aspectRatio: 3,
      tickFormatter: (label) =>
        new Date(label).toLocaleString('en-US', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
      labelFormatter: (label, payload) => {
        if (payload != undefined) {
          return new Date((payload as any[])[0].payload.key).toLocaleString(
            'en-US',
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            },
          )
        } else {
          return label
        }
      },
    },
  },
  HumanVsChatbot: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label: any) =>
        parseInt(label) > 1 || parseInt(label) == 0
          ? label + ' answers'
          : label + ' answer',
      tickFormatter: (label) => label,
    },
  },
  HumanVsChatbotVotes: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label: any) =>
        parseInt(label) > 1 || parseInt(label) == 0
          ? label + ' votes'
          : label + ' vote',
      tickFormatter: (label) => label,
    },
  },
  StaffEfficiency: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      verticalAxis: true,
      size: '3xl',
      tickMargin: 15,
      aspectRatio: 4,
      minTickGap: -200,
      angle: 20,
      labelFormatter: (label: any) => ('' + label).replace(/_/g, ' '),
      valueFormatter: (value: any, name: any) =>
        `${name.replace(/_/g, ' ')}: ${value} min`,
      tickFormatter: (label) => {
        const split = ('' + label).split('_')
        return split.reduce((prev, curr) => {
          const isFirst = prev == 'START'
          if (isFirst) {
            return curr + ' '
          } else {
            return prev + curr.charAt(0) + '.'
          }
        }, 'START')
      },
    },
  },
  StaffTotalHelped: {
    chartType: 'Bar',
    props: {
      includeLegend: true,
      includeTooltip: true,
      verticalAxis: true,
      size: '3xl',
      tickMargin: 15,
      aspectRatio: 4,
      minTickGap: -200,
      angle: 20,
      labelFormatter: (label: any) => ('' + label).replace(/_/g, ' '),
      valueFormatter: (value: any, name: any) =>
        `${name.replace(/_/g, ' ')}: ${value} questions`,
      tickFormatter: (label) => {
        const split = ('' + label).split('_')
        return split.reduce((prev, curr) => {
          const isFirst = prev == 'START'
          if (isFirst) {
            return curr + ' '
          } else {
            return prev + curr.charAt(0) + '.'
          }
        }, 'START')
      },
    },
  },
}

export const gantt_charts: {
  [key: string]: GanttChartComponent
} = {
  MostActiveTimes: {
    props: {
      includeTooltip: true,
      size: '4xl',
      labelFormatter: (
        label: string,
        payload: TooltipPayload<string, NameType>[],
      ) => {
        if (payload != undefined) {
          const p = (payload as any[])[0]?.payload
          return (
            numToWeekday(p.Weekday) + `  (${getMinutesToTime(p.key as number)})`
          )
        } else {
          return label
        }
      },
      xTickFormatter: (label: string) => {
        const num = parseInt(label)
        if (isNaN(num)) {
          return ''
        }
        return getMinutesToTime(num)
      },
      yTickFormatter: (label: string) =>
        numToWeekday(parseInt(label)).substring(0, 3),
      valueFormatter: (label: any, key: any, body: any) => {
        if (key == 'key') {
          const payload: any = body.payload
          return 'Questions: ' + (payload?.Amount ?? 0)
        }
        return undefined
      },
      xRange: (chartData: ChartDataType[]) => {
        const range = generateAxisRange(chartData, ['key'], 60)
        range[0] = range[0] >= 60 ? range[0] - 60 : range[0]
        range[1] = range[1] <= 1380 ? range[1] + 60 : range[1]
        return range
      },
      aspectRatio: 3,
    },
  },
  StaffWorkload: {
    props: {
      includeTooltip: true,
      size: '4xl',
      labelFormatter: (
        label: string,
        payload: TooltipPayload<string, NameType>[],
      ) => {
        if (payload != undefined) {
          const p = (payload as any[])[0]?.payload
          return `${p['Staff_Member']} @ ${getMinutesToTime(p.key as number)}`
        } else {
          return label
        }
      },
      xTickFormatter: (label: string) => {
        const num = parseInt(label)
        if (isNaN(num)) {
          return ''
        }
        return getMinutesToTime(num)
      },
      yTickFormatter: (label: string) => {
        const splitName = label.split(' ')
        return splitName.reduce((prev, curr) => {
          if (prev == 'START') {
            return curr + ' '
          } else {
            return prev + curr.charAt(0) + '.'
          }
        }, 'START')
      },
      valueFormatter: (label: any, key: any, body: any) => {
        if (key == 'key') {
          const payload: any = body.payload
          return 'Questions: ' + (payload?.Amount ?? 0)
        }
        return undefined
      },
      xRange: (chartData: ChartDataType[]) => {
        const range = generateAxisRange(chartData, ['key'], 60)
        range[0] = range[0] >= 60 ? range[0] - 60 : range[0]
        range[1] = range[1] <= 1380 ? range[1] + 60 : range[1]
        return range
      },
      aspectRatio: 1.5,
      yIsCategory: true,
    },
  },
}
