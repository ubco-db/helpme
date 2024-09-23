import { ChartConfig } from '@/app/components/ui/chart'
import { CurveType } from 'recharts/types/shape/Curve'

export type ChartSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const AxisChartClasses = {
  xs: 'mx-auto max-w-xs',
  sm: 'mx-auto max-w-sm',
  md: 'mx-auto max-w-md',
  lg: 'mx-auto max-w-lg',
  xl: 'mx-auto max-w-xl',
  '2xl': 'mx-auto max-w-2xl',
}

export const RadialChartClasses = {
  xs: 'mx-auto aspect-square max-w-xs',
  sm: 'mx-auto aspect-square max-w-sm',
  md: 'mx-auto aspect-square max-w-md',
  lg: 'mx-auto aspect-square max-w-lg',
  xl: 'mx-auto aspect-square max-w-xl',
  '2xl': 'mx-auto aspect-square max-w-2xl',
}

export interface DefaultChartProps {
  valueKeys: string[]
  chartConfig: ChartConfig
  chartData: ChartDataType[]
  includeLegend?: boolean
  includeTooltip?: boolean
  valueFills?: { [key: string]: string }
  size?: ChartSize
}

export interface AxisChartProps extends DefaultChartProps {
  verticalAxis?: boolean
  tickLine?: boolean
  tickMargin?: number
  axisLine?: boolean
}

export interface LinearChartProps extends AxisChartProps {
  curveType?: CurveType
  showPoints?: boolean
}

export type ChartDataType = { key: string; fill?: string; [key: string]: any }
