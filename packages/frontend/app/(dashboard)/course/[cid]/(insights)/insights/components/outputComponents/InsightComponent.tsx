import React, { useEffect, useMemo, useState } from 'react'
import { useInsight } from '@/app/hooks/useInsight'
import {
  ChartOutputType,
  DateRangeType,
  InsightOutput,
  InsightParamsType,
  InsightType,
} from '@koh/common'
import InsightValueComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightValueComponent'
import InsightTableComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightTableComponent'
import InsightChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightChartComponent'
import DateOptionFilter from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/DateOptionFilter'
import StudentFilter from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/StudentFilter'
import DataFilter from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/DataFilter'
import { charts } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import QueueFilter from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/QueueFilter'
import InsightGanttChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightGanttChartComponent'

interface InsightComponentProps {
  courseId: number
  insightName: string
}

export interface GenericInsightComponentProps {
  insight: InsightOutput
  insightName: string
  filterContent: React.ReactNode
}

const InsightComponent: React.FC<InsightComponentProps> = ({
  courseId,
  insightName,
}) => {
  const [insightOutput, setInsightOutput] = useState<InsightOutput | undefined>(
    undefined,
  )
  const [dateRange, setDateRange] = useState<DateRangeType | undefined>(
    undefined,
  )
  const [selectedData, setSelectedData] = useState<string[]>([])
  const [students, setStudents] = useState<number[]>([])
  const [queues, setQueues] = useState<number[]>([])

  const insightParams = useMemo(() => {
    return {
      start: dateRange?.start,
      end: dateRange?.end,
      students: students.length != 0 ? students : undefined,
      queues: queues.length != 0 ? queues : undefined,
    } as InsightParamsType
  }, [dateRange?.end, dateRange?.start, students, queues])

  useInsight(courseId, insightName, insightParams).then((result) =>
    setInsightOutput(result),
  )

  const chartKeys = useMemo(() => {
    const matchingChart = charts[insightName]
    if (matchingChart != undefined && insightOutput != undefined) {
      const keys: string[] = []
      const output = insightOutput.output as ChartOutputType
      if (matchingChart.categoryKeys) {
        output.data.forEach((datum) => {
          const key = datum[output.xKey]
          if (!keys.includes(key)) {
            keys.push(key)
          }
        })
      } else {
        keys.push(...(output.yKeys ?? []))
      }
      return keys
    }
  }, [insightOutput, insightName])

  useEffect(() => {
    if (
      chartKeys != undefined &&
      insightOutput &&
      insightOutput.outputType == InsightType.Chart &&
      charts[insightName] != undefined &&
      !charts[insightName].allowDataFiltering
    ) {
      setSelectedData(chartKeys)
    }
  }, [chartKeys, insightName, insightOutput])

  const renderFilterOptions = useMemo(() => {
    const filterOptions: React.ReactNode[] = []

    if (
      insightOutput != undefined &&
      insightOutput.allowedFilters != undefined
    ) {
      filterOptions.push(
        ...insightOutput.allowedFilters.map((filterName) => {
          switch (filterName) {
            case 'timeframe':
              return <DateOptionFilter setRange={setDateRange} />
            case 'students':
              return (
                <StudentFilter
                  selectedStudents={students}
                  setSelectedStudents={setStudents}
                />
              )
            case 'queues':
              return (
                <QueueFilter
                  selectedQueues={queues}
                  setSelectedQueues={setQueues}
                />
              )
            default:
              return <></>
          }
        }),
      )
      if (
        insightOutput.outputType == InsightType.Chart &&
        insightName != 'MostActiveTimes' &&
        chartKeys != undefined
      ) {
        filterOptions.push(
          <DataFilter
            dataKeys={chartKeys}
            selectedData={selectedData}
            setSelectedData={setSelectedData}
          />,
        )
      }
    }

    return (
      filterOptions.length > 0 && (
        <div className="mt-2 flex flex-row justify-end gap-4">
          {filterOptions}
        </div>
      )
    )
  }, [insightOutput, insightName, students, queues, chartKeys, selectedData])

  return useMemo(() => {
    if (insightOutput == undefined) {
      return
    }

    switch (insightOutput.outputType) {
      case InsightType.Value:
        return (
          <InsightValueComponent
            insight={insightOutput}
            insightName={insightName}
            filterContent={renderFilterOptions}
          />
        )
      case InsightType.Chart:
        return (
          <InsightChartComponent
            insight={insightOutput}
            insightName={insightName}
            filterContent={renderFilterOptions}
            selectedDataSets={selectedData}
          />
        )
      case InsightType.Table:
        return (
          <InsightTableComponent
            insight={insightOutput}
            insightName={insightName}
            filterContent={renderFilterOptions}
          />
        )
      case InsightType.GanttChart:
        return (
          <InsightGanttChartComponent
            insight={insightOutput}
            insightName={insightName}
            filterContent={renderFilterOptions}
          />
        )
    }
  }, [insightName, insightOutput, renderFilterOptions, selectedData])
}

export default InsightComponent
