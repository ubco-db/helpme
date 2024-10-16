import { ChartConfig } from '@/app/components/ui/chart'
import { ChartDataType } from '@/app/(dashboard)/course/[cid]/insights/utils/types'

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

export const generateUniqueColor = (index: number, amount: number) => {
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
      key: isNaN(item[labelKey])
        ? item[labelKey].replace(/\s/g, '_')
        : item[labelKey],
    }
    if (uniquePerLabel) {
      mappedData['fill'] =
        item['fill'] != undefined
          ? item['fill']
          : generateUniqueColor(index, chartData.length)
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
      label: (
        (labelKey + '').charAt(0).toUpperCase() + (labelKey + '').slice(1)
      ).replace(/_/g, ' '),
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
      const key = item.key + '' ?? ''
      chartConfig[item.key] = {
        label: (key.charAt(0).toUpperCase() + key.slice(1)).replace(/_/g, ' '),
        color: item.fill,
      }
    }
  })

  return chartConfig satisfies ChartConfig
}

export const generateAxisRange = (
  processedChartData: ChartDataType[],
  valueKeys: string[],
  cap?: number,
) => {
  cap ??= 10
  const allValues = processedChartData
    .map((data) => {
      return valueKeys.map((key) => data[key] as number)
    })
    .reduce((prev, curr) => [...prev, ...curr], [])

  let min = Math.min(...allValues)
  const max = Math.max(...allValues)
  if (min < cap) {
    min = 0
  } else {
    min = Math.ceil(min / cap) * cap
  }

  return [min, Math.ceil(max / cap) * cap]
}

export const generateTickRange = (domain: number[], numberOfTicks: number) => {
  const interval = domain[1] - domain[0]
  const inc = Math.round(interval / numberOfTicks)
  const range: number[] = []
  for (let i = domain[0]; i < domain[1] - numberOfTicks; i += inc) {
    range.push(i)
  }
  range.push(domain[1])
  return range
}

export const getMinutesToTime = (mins: number) => {
  const hours = Math.floor(mins / 60)
  const minutes = Math.floor(mins - hours * 60)
  const hourToPm =
    hours > 0 && hours <= 12 ? hours : hours == 0 ? 12 : hours - 12

  return `${hourToPm}:${(minutes < 10 ? '0' : '') + Math.round(minutes)} ${hours == 24 || hours == 0 || hours < 12 ? 'AM' : 'PM'}`
}
