import React, { useEffect, useState } from 'react'
import { PlusCircleOutlined } from '@ant-design/icons'
import { SettingsIcon } from 'lucide-react'
import { CloseIcon } from 'next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon'
import { Checkbox, Input, List, Modal, Select } from 'antd'
import {
  InsightDashboardPartial,
  InsightDetail,
  InsightDirectory,
  InsightDisplayInfo,
  InsightName,
  InsightType,
  ListInsightsResponse,
} from '@koh/common'
import {
  charts,
  ChartSize,
} from '@/app/(dashboard)/course/[cid]/(insights)/insights/utils/types'
import { API } from '@/app/api'

type DashboardPresetComponentProps = {
  selectedDashboard?: string
  setSelectedDashboard: (name: string) => void
  allPresets: InsightDashboardPartial[]
  setAllPresets: (items: InsightDashboardPartial[]) => void
  courseId: number
}
const DashboardPresetComponent: React.FC<DashboardPresetComponentProps> = ({
  selectedDashboard,
  setSelectedDashboard,
  allPresets,
  setAllPresets,
  courseId,
}: DashboardPresetComponentProps) => {
  const [insightsList, setInsightsList] = useState<
    ListInsightsResponse | undefined
  >(undefined)
  const [nameValue, setNameValue] = useState<string>('')

  useEffect(() => {
    API.insights
      .list()
      .then((result: ListInsightsResponse) => setInsightsList(result))
  }, [])

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isCreationModalOpen, setIsCreationModalOpen] = useState<boolean>(false)

  const [selectedInsights, setSelectedInsights] = useState<InsightName[]>([])

  const toggleInsight = (name: InsightName) => {
    setSelectedInsights((prev) =>
      prev.includes(name) ? prev.filter((s) => s != name) : [...prev, name],
    )
  }

  const translateSize = (size: ChartSize) => {
    switch (size) {
      case 'xs':
        return 'Extra Small'
      case 'sm':
        return 'Small'
      case 'md':
        return 'Medium'
      case 'lg':
        return 'Large'
      case 'xl':
        return 'Extra Large'
      default:
        return size.toUpperCase()
    }
  }

  const onCreatePreset = () => {
    if (selectedInsights.length <= 0) {
      return
    }

    const preset: InsightDetail = {}
    Object.keys(InsightDirectory).forEach((name) => {
      preset[name] = InsightDirectory[name]
      preset[name].active = selectedInsights.includes(name)
    })

    API.insights
      .createOrUpdatePreset(courseId, nameValue != '' ? nameValue : undefined)
      .then((result: InsightDashboardPartial[]) => {
        setAllPresets(result)
        if (selectedDashboard == undefined && result.length > 0) {
          setSelectedDashboard(result[result.length - 1].name)
        }
      })

    onModalClose()
  }

  const onModalClose = () => {
    setIsCreationModalOpen(false)
  }

  const pillContainerClass = 'flex flex-row flex-wrap gap-2 justify-end'
  const pillLabelClass =
    'rounded-md p-2 border-2 border-blue-400 bg-blue-100 text-center flex justify-center items-center'

  return (
    <>
      {insightsList != undefined && (
        <Modal
          title={'Create New Dashboard Preset'}
          width={'48rem'}
          open={isCreationModalOpen}
          okText={'Create Preset'}
          onOk={onCreatePreset}
          onCancel={onModalClose}
        >
          <Input
            type={'text'}
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            maxLength={20}
          />
          {allPresets != undefined &&
            allPresets.map((p) => p.name).includes(nameValue) && (
              <p>
                A preset with the specified name exists, and will be
                overwritten.
              </p>
            )}
          <List
            className="my-2 max-h-96 overflow-y-auto"
            dataSource={Object.keys(insightsList).map((key) => {
              return {
                name: key,
                displayInfo: insightsList[key],
              }
            })}
            renderItem={(
              item: { name: string; displayInfo: InsightDisplayInfo },
              index: number,
            ) => {
              const { name, displayInfo } = item
              const matchingChart = charts[item.name]
              const detailsNode: React.ReactNode = (
                <div className={pillContainerClass}>
                  <div className={pillLabelClass}>
                    {(displayInfo.insightType == InsightType.Chart &&
                      `${matchingChart?.chartType} Chart`) ||
                      (displayInfo.insightType == InsightType.Value &&
                        'Single Value') ||
                      (displayInfo.insightType == InsightType.Table && 'Table')}
                  </div>
                  <div className={pillLabelClass}>
                    {(displayInfo.insightType == InsightType.Chart &&
                      `${
                        matchingChart?.props.size
                          ? translateSize(matchingChart.props.size)
                          : 'Medium'
                      }`) ||
                      (displayInfo.insightType == InsightType.Value &&
                        'Small') ||
                      (displayInfo.insightType == InsightType.Table &&
                        'Size Varies')}
                  </div>
                </div>
              )
              return (
                <List.Item key={index} className="flex">
                  <label className="flex flex-auto">
                    <Checkbox
                      checked={selectedInsights.includes(name)}
                      onChange={() => toggleInsight(name)}
                    />
                    <div className="ml-2 flex flex-auto flex-row justify-between">
                      <div className={'mr-4 flex flex-col gap-2'}>
                        <div>
                          <b>{name.replace(/([A-Z])/g, ' $1')}</b>
                        </div>
                        <div>{displayInfo.description}</div>
                      </div>
                      {detailsNode}
                    </div>
                  </label>
                </List.Item>
              )
            }}
            bordered
          />
        </Modal>
      )}
      <div className="absolute right-1 flex flex-row">
        <button
          className={`${isOpen ? 'bg-zinc-300' : 'bg-helpmeblue'} ${isOpen ? 'rounded-l-lg' : 'rounded-lg'} p-2 shadow-lg ${isOpen ? 'md:hover:bg-zinc-200' : 'md:hover:bg-helpmeblue-light'} md:hover:shadow-2xl`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <CloseIcon /> : <SettingsIcon className="text-white" />}
        </button>
        <div
          className={`${isOpen ? '' : 'hidden'} flex flex-col gap-4 rounded-r-lg border-2 border-y-zinc-300 border-r-zinc-300 border-opacity-50 bg-white p-4 shadow-lg`}
        >
          <span>
            <b>Dashboard Presets</b>
          </span>
          {allPresets != undefined && allPresets.length > 0 ? (
            <Select
              value={selectedDashboard}
              onChange={(value) => setSelectedDashboard(value)}
            >
              {allPresets.map((value, index) => (
                <Select.Option key={index} value={value.name}>
                  {value.name}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <div>No presets</div>
          )}
          <button
            className="bg-helpmeblue md:hover:bg-helpmeblue-light rounded-lg p-2 text-white transition-all"
            onClick={() => setIsCreationModalOpen(true)}
          >
            <PlusCircleOutlined />
            <span className="pl-1">Create New Preset</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default DashboardPresetComponent
