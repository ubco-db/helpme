import React, { useEffect, useMemo, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons'
import { FolderOpenIcon } from 'lucide-react'
import {
  Button,
  Checkbox,
  Divider,
  Input,
  List,
  Modal,
  Select,
  Space,
} from 'antd'
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
import { CloseIcon } from 'next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon'

type DashboardPresetComponentProps = {
  selectedDashboard?: string
  setSelectedDashboard: (name?: string) => void
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

  const [isOpen, setIsOpen] = useState<boolean>(true)
  const [isCreationModalOpen, setIsCreationModalOpen] = useState<boolean>(false)
  const [presetDropdownOpen, setPresetDropdownOpen] = useState<boolean>(false)
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
      .createOrUpdatePreset(
        courseId,
        preset,
        nameValue != '' ? nameValue : undefined,
      )
      .then((result: InsightDashboardPartial[]) => {
        setAllPresets(result)
        if (selectedDashboard == undefined && result.length > 0) {
          setSelectedDashboard(result[result.length - 1].name)
        }
      })

    onModalClose()
  }

  const preset = useMemo(
    () => allPresets?.find((p) => p.name == selectedDashboard),
    [allPresets, selectedDashboard],
  )

  const onModalClose = () => {
    setSelectedInsights([])
    setIsCreationModalOpen(false)
  }

  const isOpenClass =
    'flex flex-col gap-4 rounded-lg border-2 border-zinc-300 border-opacity-50 bg-white p-4 shadow-lg'
  const pillContainerClass = 'flex flex-row flex-wrap gap-2 justify-end'
  const pillLabelClass =
    'rounded-md p-2 border-2 border-blue-400 bg-blue-100 text-center flex justify-center items-center'
  const disableButton = 'bg-zinc-300 hover:bg-zinc-400'

  return (
    <>
      {insightsList != undefined && (
        <Modal
          title={'Create New Dashboard Preset'}
          width={'48rem'}
          open={isCreationModalOpen}
          okText={
            selectedInsights.length > 0
              ? 'Create Preset'
              : 'At least one insight must be selected'
          }
          okButtonProps={{
            className: selectedInsights.length <= 0 ? disableButton : undefined,
          }}
          onOk={onCreatePreset}
          onCancel={onModalClose}
        >
          <Input
            type={'text'}
            placeholder={'Enter preset name (Optional)'}
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            maxLength={20}
          />
          {allPresets != undefined &&
            allPresets.map((p) => p.name).includes(nameValue) && (
              <p className={'my-4 text-center'}>
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
      <div className={'sticky top-10 z-10 float-right h-0 overflow-visible'}>
        <div className="relative top-[-100%] flex flex-row">
          <div className={isOpen ? isOpenClass : ''}>
            <div className={'flex flex-row justify-between gap-3'}>
              {isOpen && (
                <span>
                  <b>Dashboard Presets</b>
                </span>
              )}
              <Button
                className={
                  'text-helpmeblue border-helpmeblue hover:bg-helpmeblue aspect-square h-min w-min border-0 p-1 hover:border-white hover:text-white'
                }
                onClick={() => setIsOpen(!isOpen)}
              >
                {isOpen ? <CloseIcon /> : <FolderOpenIcon />}
              </Button>
            </div>
            {isOpen ? (
              <div className={'flex w-full flex-auto flex-col gap-2'}>
                <Select
                  showSearch
                  open={presetDropdownOpen}
                  value={selectedDashboard}
                  onChange={(v) => {
                    setSelectedDashboard(v)
                    setPresetDropdownOpen(false)
                  }}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input)
                  }
                  onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
                  options={
                    allPresets?.map((preset) => {
                      return {
                        value: preset.name,
                        label: preset.name,
                      }
                    }) ?? []
                  }
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider className={'my-2'} />
                      <Space className={'flex flex-col'}>
                        <Button
                          className="border-green-500 text-green-500 transition-all hover:border-green-50 hover:bg-green-500 hover:text-green-50"
                          onClick={() => setIsCreationModalOpen(true)}
                        >
                          <PlusCircleOutlined />
                          <span className="pl-1">New Preset</span>
                        </Button>
                      </Space>
                    </>
                  )}
                />
                {selectedDashboard != undefined && preset != undefined && (
                  <div className={'flex flex-row gap-2'}>
                    <Button
                      className={
                        'text-helpmeblue border-helpmeblue hover:bg-helpmeblue transition-all hover:border-white hover:text-white'
                      }
                      onClick={() => {
                        setSelectedInsights(
                          Object.keys(preset.insights).filter(
                            (key) => preset.insights[key].active,
                          ),
                        )
                        setNameValue(preset?.name)
                        setIsCreationModalOpen(true)
                      }}
                    >
                      <EditOutlined />
                      Edit
                    </Button>
                    <Button
                      className={
                        'border-red-500 text-red-500 transition-all hover:border-red-50 hover:bg-red-500 hover:text-red-50'
                      }
                      onClick={() => {
                        API.insights
                          .removePreset(courseId, preset.name)
                          .then((dashboard) => {
                            if (
                              !dashboard.find(
                                (p) => p.name == selectedDashboard,
                              )
                            ) {
                              setSelectedDashboard(undefined)
                            }
                            setAllPresets(dashboard)
                          })
                      }}
                    >
                      <DeleteOutlined />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DashboardPresetComponent
