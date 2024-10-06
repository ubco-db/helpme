import { ChartConfig } from '@/app/components/ui/chart'
import { CurveType } from 'recharts/types/shape/Curve'
import { ChartType } from '@koh/common'
import {
  NameType,
  Payload as TooltipPayload,
} from 'recharts/types/component/DefaultTooltipContent'
import { Formatter } from 'recharts/types/component/DefaultLegendContent'
export type ChartSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

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

export interface DefaultChartProps {
  valueKeys: string[]
  chartConfig: ChartConfig
  chartData: ChartDataType[]
  includeLegend?: boolean
  includeTooltip?: boolean
  valueFills?: { [key: string]: string }
  xType?: 'numeric' | 'category'
  size?: ChartSize
  labelFormatter?: (
    label: any,
    payload: TooltipPayload<string, NameType>[],
  ) => React.ReactNode
  valueFormatter?: (label: string) => string
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
  axisLine?: boolean
  tickFormatter?: (label: string) => string
  axisRatio?: number
}

export interface BarChartProps extends AxisChartProps, StackChartProps {}

export interface PointChartProps extends AxisChartProps {
  showPoints?: boolean
  fullPointFill?: boolean
}

export interface LinearChartProps extends PointChartProps {
  curveType?: CurveType
}

export type ChartDataType = { key: string; fill?: string; [key: string]: any }

export type ChartComponent = {
  chartType: ChartType
  categoryKeys?: boolean
  props:
    | Partial<DefaultChartProps>
    | Partial<RadialChartProps>
    | Partial<AxisChartProps>
    | Partial<PointChartProps>
    | Partial<LinearChartProps>
    | Partial<BarChartProps>
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
      valueFormatter: (label) => label + ' minutes',
    },
  },
  HelpSeekingOverTime: {
    chartType: 'Area',
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: '4xl',
      axisRatio: 3,
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
      valueFormatter: (label) =>
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
      valueFormatter: (label) =>
        parseInt(label) > 1 || parseInt(label) == 0
          ? label + ' votes'
          : label + ' vote',
      tickFormatter: (label) => label,
    },
  },
}
