import { Heatmap } from '@koh/common'
import { chunk, mean } from 'lodash'

export function findWeekMinAndMax(days: Heatmap) {
  let minHourInWeek = 24
  let maxHourInWeek = 0
  days.forEach((v, hour) => {
    if (v >= 0) {
      if (hour % 24 > maxHourInWeek) {
        maxHourInWeek = hour % 24
      }
      if (hour % 24 < minHourInWeek) {
        minHourInWeek = hour % 24
      }
    }
  })
  if (maxHourInWeek < minHourInWeek) {
    return [0, 23]
  }
  return [minHourInWeek, maxHourInWeek]
}

export function arrayRotate<T>(arr: T[], count: number): T[] {
  const adjustedCount = (arr.length + count) % arr.length
  return arr
    .slice(adjustedCount, arr.length)
    .concat(arr.slice(0, adjustedCount))
}

export const collapseHeatmap = (heatmap: Heatmap): Heatmap =>
  chunk(heatmap, 4).map((hours) => {
    const filteredOfficeHours = hours.filter((v) => v !== -1)
    return filteredOfficeHours.length > 0 ? mean(filteredOfficeHours) : -1
  })
