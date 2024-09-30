import { DateRangeType } from '@koh/common'
import React, { useState } from 'react'
import { Select, DatePicker } from 'antd'
import dayjs from 'dayjs'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/FilterWrapper'

const { RangePicker } = DatePicker
const { Option } = Select

export type DateFilterOptionType =
  | 'Past_Day'
  | 'Past_Week'
  | 'Past_Month'
  | 'Past_3_Months'
  | 'Past_6_Months'
  | 'Past_Year'
  | 'All_Time'
  | 'Custom'
type DateSelectType = 'date' | 'week' | 'month' | 'year'

const DateFilterOptions: { [key in DateFilterOptionType]: string } = {
  Past_Day: 'Past Day',
  Past_Week: 'Past Week',
  Past_Month: 'Past Month',
  Past_3_Months: 'Past 3 Months',
  Past_6_Months: 'Past 6 Months',
  Past_Year: 'Past Year',
  All_Time: 'All Time',
  Custom: 'Custom',
}

const DateSelectOptions: { [key in DateSelectType]: string } = {
  date: 'Date',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

type DateOptionFilterProps = {
  setRange: (value: DateRangeType) => void
}

const dateFormat = 'YYYY-MM-DD'

const DateOptionFilter: React.FC<DateOptionFilterProps> = ({ setRange }) => {
  const [selectedOption, setSelectedOption] =
    useState<DateFilterOptionType>('All_Time')
  const [selectedType, setSelectedType] = useState<DateSelectType>('date')

  const getDateRange = (option: DateFilterOptionType) => {
    if (option == 'Custom') {
      return
    }

    const currentMillis = Date.now()

    const dateRange: DateRangeType = {
      start: new Date(0).toString(),
      end: new Date(currentMillis).toString(),
    }

    switch (option) {
      case 'Past_Day':
        dateRange.start = new Date(currentMillis - 86400000).toString()
        break
      case 'Past_Week':
        dateRange.start = new Date(currentMillis - 7 * 86400000).toString()
        break
      case 'Past_Month':
        dateRange.start = new Date(currentMillis - 31 * 86400000).toString()
        break
      case 'Past_3_Months':
        dateRange.start = new Date(currentMillis - 93 * 86400000).toString()
        break
      case 'Past_6_Months':
        dateRange.start = new Date(currentMillis - 186 * 86400000).toString()
        break
      case 'Past_Year':
        dateRange.start = new Date(currentMillis - 392 * 86400000).toString()
        break
    }

    return dateRange
  }

  const getCustomDateRange = (start: Date, end: Date) => {
    return { start: start.toString(), end: end.toString() }
  }

  const onRangeChange = (_dates: any, dateStrings: [string, string]) => {
    setRange(
      getCustomDateRange(new Date(dateStrings[0]), new Date(dateStrings[1])),
    )
  }

  return (
    <FilterWrapper title={'Timeframe'}>
      <div className="flex flex-row gap-4">
        <Select
          className="min-w-32 flex-grow"
          value={selectedOption}
          onChange={(value) => {
            setSelectedOption(value)
            const dateRange = getDateRange(value)
            if (dateRange != undefined) {
              setRange(dateRange)
            }
          }}
        >
          {Object.keys(DateFilterOptions).map((key, index) => (
            <Option key={index} value={key}>
              {DateFilterOptions[key as DateFilterOptionType]}
            </Option>
          ))}
        </Select>
        {selectedOption == 'Custom' && (
          <div className="flex flex-row gap-4">
            <Select value={selectedType} onChange={setSelectedType}>
              {Object.keys(DateSelectOptions).map((key, index) => (
                <Option key={index} value={key.toLowerCase()}>
                  {DateSelectOptions[key as DateSelectType]}
                </Option>
              ))}
            </Select>
            <RangePicker
              picker={selectedType}
              maxDate={dayjs(new Date(Date.now()).toString(), dateFormat)}
              onChange={onRangeChange}
            />
          </div>
        )}
      </div>
    </FilterWrapper>
  )
}

export default DateOptionFilter
