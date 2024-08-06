import {
  ClockCircleOutlined,
  DownOutlined,
  HourglassOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Heatmap } from '@koh/common'
import { ParentSize } from '@visx/responsive'
import { Dropdown, Menu } from 'antd'
import { chunk, uniq, mean, sortBy } from 'lodash'
import { useState } from 'react'
import TimeGraph from './TimeGraph'
import { formatDateHour, formatWaitTime } from '@/app/utils/timeFormatUtils'
import { findWeekMinAndMax } from '../../utils/popularTimesFunctions'

interface HeatmapProps {
  heatmap: Heatmap
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const BUSY = {
  shortest: 'the shortest',
  shorter: 'shorter than usual',
  avg: 'average',
  longer: 'longer than usual',
  longest: 'the longest',
}

// Mapping for text describing level of business, given the length of the unique wait times that week (to account for days without hours)
const BUSY_TEXTS: Record<number, string[]> = {
  1: [BUSY.avg],
  2: [BUSY.shortest, BUSY.longest],
  3: [BUSY.shortest, BUSY.avg, BUSY.longest],
  4: [BUSY.shortest, BUSY.shorter, BUSY.longer, BUSY.longest],
  5: [BUSY.shortest, BUSY.shorter, BUSY.avg, BUSY.longer, BUSY.longest],
  6: [
    BUSY.shortest,
    BUSY.shorter,
    BUSY.shorter,
    BUSY.longer,
    BUSY.longer,
    BUSY.longest,
  ],
  7: [
    BUSY.shortest,
    BUSY.shorter,
    BUSY.shorter,
    BUSY.avg,
    BUSY.longer,
    BUSY.longer,
    BUSY.longest,
  ],
}

function generateBusyText(day: number, dailySumWaitTimes: number[]): string {
  const dayWaitTime = dailySumWaitTimes[day]
  const uniqSumWaitTimes = uniq(sortBy(dailySumWaitTimes.filter((v) => v >= 0)))
  const rank = uniqSumWaitTimes.indexOf(dayWaitTime)
  return BUSY_TEXTS[uniqSumWaitTimes.length][rank]
}

/**
 * Component that displays the popular times for a given heatmap for the course page.
 * This was barely touched during the great frontend refactor except for making it more accessible.
 */
const PopularTimes: React.FC<HeatmapProps> = ({ heatmap }) => {
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState(new Date().getDay())
  const [firstHour, lastHour] = findWeekMinAndMax(heatmap)
  const dailyAvgWaitTimes: number[] = chunk(heatmap, 24).map((hours) => {
    const filteredOfficeHours = hours.filter((v) => v !== -1)
    return filteredOfficeHours.length > 0 ? mean(filteredOfficeHours) : -1
  })

  return (
    <div>
      <div className="flex items-baseline">
        <h3 className="text-xl font-bold">Wait Times on</h3>
        <Dropdown
          trigger={['click']}
          menu={{
            items: DAYS_OF_WEEK.map((dayName, i) => ({
              key: i,
              label: dayName,
            })),
            onClick: ({ key }) => setCurrentDayOfWeek(Number(key)),
          }}
        >
          <button
            onClick={(e) => e.preventDefault()}
            className="text-helpmeblue hover:text-helpmeblue-light focus:text-helpmeblue-light ml-2 flex items-center text-xl font-bold"
          >
            {DAYS_OF_WEEK[currentDayOfWeek]}
            <DownOutlined className="pl-1 pt-1 text-lg" />
          </button>
        </Dropdown>
      </div>
      <div className="mb-5 flex items-center text-2xl">
        <button
          className="px-1 py-5 hover:text-gray-500 active:text-gray-400"
          aria-label="Previous Day"
          onClick={() => setCurrentDayOfWeek((7 + currentDayOfWeek - 1) % 7)}
        >
          <LeftOutlined />
        </button>
        <div className="min-w-0 flex-grow">
          <ParentSize>
            {({ width }) => (
              <TimeGraph
                values={heatmap
                  .slice(currentDayOfWeek * 24, (currentDayOfWeek + 1) * 24 - 1)
                  .map((i) => (i < 0 ? 0 : Math.floor(i)))}
                maxTime={Math.max(...heatmap)}
                firstHour={firstHour}
                lastHour={lastHour}
                width={width}
                height={220}
              />
            )}
          </ParentSize>
        </div>
        <button
          className="px-1 py-5 text-2xl hover:text-gray-500 active:text-gray-400"
          aria-label="Next Day"
          onClick={() => setCurrentDayOfWeek((currentDayOfWeek + 1) % 7)}
        >
          <RightOutlined />
        </button>
      </div>
      {dailyAvgWaitTimes[currentDayOfWeek] >= 0 && (
        <div className="pl-10 text-sm">
          <ClockCircleOutlined /> {DAYS_OF_WEEK[currentDayOfWeek]}s have{' '}
          <strong>
            {generateBusyText(currentDayOfWeek, dailyAvgWaitTimes)}
          </strong>{' '}
          wait times.
        </div>
      )}
      {new Date().getDay() === currentDayOfWeek &&
        heatmap[currentDayOfWeek * 24 + new Date().getHours()] >= 0 && (
          <div className="pl-10 text-sm">
            <HourglassOutlined /> At {formatDateHour(new Date().getHours())},
            people generally wait{' '}
            <strong>
              {formatWaitTime(
                heatmap[currentDayOfWeek * 24 + new Date().getHours()],
              )}
            </strong>
            .
          </div>
        )}
    </div>
  )
}

export default PopularTimes
