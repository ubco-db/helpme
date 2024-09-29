import { ChartConfig } from '@/app/components/ui/chart'
import { CurveType } from 'recharts/types/shape/Curve'

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
