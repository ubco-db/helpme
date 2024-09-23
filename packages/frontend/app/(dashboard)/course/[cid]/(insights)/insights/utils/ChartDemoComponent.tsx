import React, { useMemo, useState } from 'react'
import { CurveType } from 'recharts/types/shape/Curve'
import {
  constructChartConfig,
  processChartData,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/functions'
import BarChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/BarChartComponent'
import { ChartSize } from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import LineChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/LineChartComponent'
import InsightCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/InsightCard'
import RadarChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/RadarChartComponent'
import RadialChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/RadialChartComponent'
import PieChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/PieChartComponent'
import AreaChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/AreaChartComponent'
import ScatterChartComponent from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/charts/ScatterChartComponent'

const chartTypes = [
  'Area Chart',
  'Bar Chart',
  'Line Chart',
  'Pie Chart',
  'Radar Chart',
  'Radial Chart',
  'Scatter Chart',
]
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const numberOfDataSets = 5

const spoofData = (() => {
  const data: { [key: string]: any }[] = []
  for (const month of months) {
    const datum: { [key: string]: any } = {}
    datum['month'] = month
    for (let i = 1; i <= numberOfDataSets; i++) {
      datum['data' + i] = 50 + Math.random() * 300
    }
    data.push(datum)
  }
  return data
})()

const fullSet = (() => {
  const set: string[] = []
  for (let i = 1; i <= numberOfDataSets; i++) {
    set.push('data' + i)
  }
  return set
})()

const ChartDemoComponent: React.FC = () => {
  const [chartType, setChartType] = useState<string>('Line Chart')
  const [datasets, setDataSets] = useState<string[]>(fullSet)
  const [showPoints, setShowPoints] = useState<boolean>(false)
  const [showLabels, setShowLabels] = useState<boolean>(false)
  const [stackData, setStackData] = useState<boolean>(false)
  const [selectedMonths, setSelectedMonths] = useState<string[]>(months)
  const [selectedData, setSelectedData] = useState<string>('data1')
  const [size, setSize] = useState<string>('md')
  const [lineType, setLineType] = useState<CurveType>('monotone')

  const alterSet = (prev: any[], lookupValue: any) => {
    return prev.includes(lookupValue)
      ? prev.filter((s) => s != lookupValue)
      : [...prev, lookupValue]
  }

  const toggleDataSet = (dataset: string) => {
    setDataSets((prev) => alterSet(prev, dataset))
  }

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) => alterSet(prev, month))
  }

  const renderCheckboxOptions = (
    options: string[],
    checkedFx: (value: string) => boolean,
    onChange: (value: string) => void,
  ) => {
    return options.map((item, index) => (
      <div key={item + '-' + index} className={'flex flex-row gap-1'}>
        <input
          type={'checkbox'}
          value={item}
          checked={checkedFx(item)}
          onChange={() => onChange(item)}
        />
        {item}
      </div>
    ))
  }

  const renderOptions = (options: string[]) => {
    return options.map((item, index) => (
      <option key={item + '-' + index} value={item}>
        {item}
      </option>
    ))
  }

  const dataSubset = useMemo(
    () =>
      spoofData
        .filter((data) => selectedMonths.includes(data.month))
        .map((data) => {
          return {
            month: data.month,
            [selectedData]: data[selectedData],
          }
        }),
    [selectedData, selectedMonths],
  )

  const { data, keys, fills } = useMemo(
    () =>
      chartType == 'Radial Chart' || chartType == 'Pie Chart'
        ? processChartData(dataSubset, 'month', [selectedData], true)
        : processChartData(spoofData, 'month', datasets),
    [chartType, dataSubset, selectedData, datasets],
  )

  const chartConfig = useMemo(
    () =>
      chartType == 'Radial Chart' || chartType == 'Pie Chart'
        ? constructChartConfig(data)
        : constructChartConfig(data, keys, fills),
    [chartType, data, keys, fills],
  )

  const chartRender = useMemo(() => {
    switch (chartType) {
      case 'Area Chart':
        return (
          <AreaChartComponent
            showPoints={showPoints}
            curveType={lineType}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Bar Chart':
        return (
          <BarChartComponent
            stackData={stackData}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Line Chart':
        return (
          <LineChartComponent
            showPoints={showPoints}
            curveType={lineType}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Pie Chart':
        return (
          <PieChartComponent
            showLabel={showLabels}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Radar Chart':
        return (
          <RadarChartComponent
            showPoints={showPoints}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Radial Chart':
        return (
          <RadialChartComponent
            stackData={stackData}
            showLabels={showLabels}
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
      case 'Scatter Chart':
        return (
          <ScatterChartComponent
            chartConfig={chartConfig}
            chartData={data}
            valueKeys={keys}
            valueFills={fills}
            size={size as ChartSize}
          />
        )
    }
  }, [
    chartConfig,
    chartType,
    data,
    fills,
    keys,
    lineType,
    showLabels,
    showPoints,
    size,
    stackData,
  ])

  return (
    <InsightCard
      title={`${chartType} Demo`}
      subtitle={`This is a demonstration of a ${chartType}.`}
    >
      {chartRender}
      <div className={'flex flex-row justify-center gap-8 p-4'}>
        <div className="flex flex-col gap-4">
          {(chartType == 'Line Chart' || chartType == 'Area Chart') && (
            <div className="flex flex-row items-center gap-2">
              <h3>Line Type</h3>
              <select
                className={'flex-1 p-2'}
                value={lineType as string}
                onChange={(evt) => setLineType(evt.target.value as CurveType)}
              >
                <option value="basis">Basis</option>
                <option value="basisClosed">Basis Closed</option>
                <option value="basisOpen">Basis Open</option>
                <option value="bumpX">Bump X</option>
                <option value="bumpY">Bump Y</option>
                <option value="bump">Bump</option>
                <option value="linear">Linear</option>
                <option value="linearClosed">Linear Closed</option>
                <option value="natural">Natural</option>
                <option value="monotoneX">Monotone X</option>
                <option value="monotoneY">Monotone Y</option>
                <option value="monotone">Monotone</option>
                <option value="step">Step</option>
                <option value="stepBefore">Step Before</option>
                <option value="stepAfter">Step After</option>
              </select>
            </div>
          )}
          <div className="flex flex-row items-center gap-2">
            <h3>Chart Type:</h3>
            <select
              className={'flex-1 p-2'}
              value={chartType}
              onChange={(evt) => setChartType(evt.target.value as string)}
            >
              {renderOptions(chartTypes)}
            </select>
          </div>
        </div>
        <div className={'flex flex-col gap-4'}>
          {((chartType == 'Radial Chart' || chartType == 'Pie Chart') && (
            <div className={'flex flex-row gap-2'}>
              <h3>Dataset:</h3>
              <div className={'flex flex-row gap-1'}>
                <select
                  className={'flex-1 p-2'}
                  value={selectedData}
                  onChange={(evt) =>
                    setSelectedData(evt.target.value as string)
                  }
                >
                  {renderOptions(datasets)}
                </select>
              </div>
            </div>
          )) || (
            <div className={'flex flex-row gap-2'}>
              <h3>Data:</h3>
              <div className={'flex flex-row flex-wrap gap-2'}>
                {renderCheckboxOptions(
                  fullSet,
                  (value: string) => datasets.includes(value),
                  toggleDataSet,
                )}
              </div>
            </div>
          )}
          <div className={'flex flex-row gap-2'}>
            <h3>Months:</h3>
            <div className={'flex flex-row flex-wrap gap-2'}>
              {renderCheckboxOptions(
                months,
                (value: string) => selectedMonths.includes(value),
                toggleMonth,
              )}
            </div>
          </div>
          {(chartType == 'Line Chart' ||
            chartType == 'Radar Chart' ||
            chartType == 'Area Chart') && (
            <div className={'flex flex-row gap-2'}>
              <h3>Show Points:</h3>
              <div className={'flex flex-row gap-1'}>
                <input
                  type={'checkbox'}
                  checked={showPoints}
                  onChange={() => setShowPoints(!showPoints)}
                />
              </div>
            </div>
          )}
          {(chartType == 'Radial Chart' || chartType == 'Pie Chart') && (
            <div className={'flex flex-row gap-2'}>
              <h3>Show Labels:</h3>
              <div className={'flex flex-row gap-1'}>
                <input
                  type={'checkbox'}
                  checked={showLabels}
                  onChange={() => setShowLabels(!showLabels)}
                />
              </div>
            </div>
          )}
          {(chartType == 'Radial Chart' || chartType == 'Bar Chart') && (
            <div className={'flex flex-row gap-2'}>
              <h3>Stack Data:</h3>
              <div className={'flex flex-row gap-1'}>
                <input
                  type={'checkbox'}
                  checked={stackData}
                  onChange={() => setStackData(!stackData)}
                />
              </div>
            </div>
          )}
          <div className={'flex flex-row items-center gap-2'}>
            <h3>Size:</h3>
            <select
              className={'p-2'}
              value={size}
              onChange={(evt) => setSize(evt.target.value as string)}
            >
              <option value="xs">Extra Small</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
              <option value="2xl">XXL</option>
            </select>
          </div>
        </div>
      </div>
    </InsightCard>
  )
}

export default ChartDemoComponent
