import { ChartConfig } from '@/app/components/ui/chart'
import { CurveType } from 'recharts/types/shape/Curve'
import { ChartType } from '@koh/common'

export type ChartSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

export const AxisChartClasses = {
  xs: 'mx-auto max-w-xs',
  sm: 'mx-auto max-w-sm',
  md: 'mx-auto max-w-md',
  lg: 'mx-auto max-w-lg',
  xl: 'mx-auto max-w-xl',
  '2xl': 'mx-auto max-w-2xl',
  '3xl': 'mx-auto max-w-3xl',
  '4xl': 'mx-auto max-w-4xl',
}

export const RadialChartClasses = {
  xs: 'mx-auto aspect-square max-w-xs',
  sm: 'mx-auto aspect-square max-w-sm',
  md: 'mx-auto aspect-square max-w-md',
  lg: 'mx-auto aspect-square max-w-lg',
  xl: 'mx-auto aspect-square max-w-xl',
  '2xl': 'mx-auto aspect-square max-w-2xl',
  '3xl': 'mx-auto aspect-square max-w-3xl',
  '4xl': 'mx-auto aspect-square max-w-4xl',
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
  size?: ChartSize
  labelFormatter?: (label: string) => string
  valueFormatter?: (label: string) => string
  legendFormatter?: (label: string) => string
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
      showLabels: false,
      size: 'sm',
    },
  },
  AverageWaitTimeByWeekDay: {
    chartType: 'Bar',
    categoryKeys: true,
    props: {
      includeLegend: true,
      includeTooltip: true,
      size: 'lg',
      valueFormatter: (label) => label + ' minutes',
    },
  },
  HelpSeekingOverTime: {
    chartType: 'Line',
    props: {
      includeLegend: true,
      includeTooltip: true,
      showPoints: true,
      size: '2xl',
      tickFormatter: (label) =>
        new Date(Date.parse(label.replace(/_/g, ' '))).toLocaleString('en-US', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
      labelFormatter: (label) => label.replace(/_/g, ' '),
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
}
