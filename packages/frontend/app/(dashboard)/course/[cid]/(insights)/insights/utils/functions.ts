import { ChartConfig } from '@/app/components/ui/chart'
import { ChartDataType } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'

const hsvToHex = (h: number, s: number, v: number) => {
  const a = s * Math.min(v, 1 - v)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = v - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const generateUniqueColor = (index: number, amount: number) => {
  return hsvToHex((360 / amount) * index, 0.75, 0.5)
}

export const processChartData = (
  chartData: { [key: string]: any }[],
  labelKey: string,
  valueKeys: string[],
  uniquePerLabel?: boolean,
): {
  data: ChartDataType[]
  keys: string[]
  fills: { [key: string]: string }
} => {
  const fills: { [key: string]: string } = {}
  const keys: string[] = valueKeys.map((item) => item.replace(/\s/g, '_'))

  if (!uniquePerLabel) {
    keys.forEach((item, index) => {
      fills[item] = generateUniqueColor(index, keys.length)
    })
  }

  const data = chartData.map((item, index) => {
    const mappedData: ChartDataType = {
      key: item[labelKey].replace(/\s/g, '_'),
    }
    if (uniquePerLabel) {
      mappedData['fill'] = generateUniqueColor(index, chartData.length)
    }
    valueKeys.forEach((key) => {
      mappedData[key] = item[key]
    })
    return mappedData
  })

  return { data, keys, fills }
}

export const constructChartConfig = (
  processedChartData: ChartDataType[],
  labelKey: string,
  valueKeys?: string[],
  fills?: { [key: string]: string },
): ChartConfig => {
  const chartConfig: { [key: string]: any } = {
    [labelKey]: {
      label: (labelKey.charAt(0).toUpperCase() + labelKey.slice(1)).replace(
        /_/g,
        ' ',
      ),
    },
  }

  processedChartData.forEach((item) => {
    if (valueKeys != undefined) {
      valueKeys.forEach((key) => {
        chartConfig[key] = {
          label: (key.charAt(0).toUpperCase() + key.slice(1)).replace(
            /_/g,
            ' ',
          ),
          color: fills ? fills[key] : item.fill,
        }
      })
    } else {
      chartConfig[item.key] = {
        label: (item.key.charAt(0).toUpperCase() + item.key.slice(1)).replace(
          /_/g,
          ' ',
        ),
        color: item.fill,
      }
    }
  })

  return chartConfig satisfies ChartConfig
}

export const generateYAxisRange = (
  processedChartData: ChartDataType[],
  valueKeys: string[],
) => {
  const allValues = processedChartData
    .map((data) => {
      return valueKeys.map((key) => data[key] as number)
    })
    .reduce((prev, curr) => [...prev, ...curr], [])

  return [
    Math.ceil(Math.min(...allValues, 0) / 10) * 10,
    Math.ceil(Math.max(...allValues) / 10) * 10,
  ]
}
