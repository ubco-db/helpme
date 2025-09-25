import {
  ChatbotProvider,
  CourseChatbotSettings,
  LLMType,
  OrganizationChatbotSettings,
} from '@koh/common'
import React, { useMemo, useState } from 'react'
import { Button, Card, Input, Pagination, Tooltip } from 'antd'
import {
  EditOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import ChatbotSettingsModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_settings/components/ChatbotSettingsModal'
import { cn } from '@/app/utils/generalUtils'

type OrganizationChatbotSettingsFormProps = {
  organizationSettings: OrganizationChatbotSettings
  courseSettingsInstances: CourseChatbotSettings[]
  onUpdate: (courseSettings: CourseChatbotSettings) => void
  pageSize?: number
}

const CourseSettingTable: React.FC<OrganizationChatbotSettingsFormProps> = ({
  organizationSettings,
  courseSettingsInstances,
  onUpdate,
  pageSize = 9,
}) => {
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [editingSettings, setEditingSettings] =
    useState<CourseChatbotSettings>()

  const modelList = useMemo(
    () =>
      organizationSettings.providers
        .map((p: ChatbotProvider) => p.availableModels)
        .reduce((p, c) => [...p, ...c], []),
    [organizationSettings],
  )

  const cancelUpdate = () => {
    setEditingSettings(undefined!)
  }

  const orderedCourseSettings = useMemo(
    () =>
      courseSettingsInstances
        ? courseSettingsInstances.sort((a, b) => a.courseId - b.courseId)
        : undefined,
    [courseSettingsInstances],
  )

  const searchedCourseSettings = useMemo(
    () =>
      orderedCourseSettings
        ? search.trim() != ''
          ? orderedCourseSettings.filter((c) =>
              c.course?.name
                ?.toLowerCase()
                .includes(search.trim().toLowerCase()),
            )
          : orderedCourseSettings
        : undefined,
    [orderedCourseSettings, search],
  )

  const paginatedCourseSettings = useMemo(
    () =>
      searchedCourseSettings
        ? searchedCourseSettings.slice((page - 1) * pageSize, page * pageSize)
        : undefined,
    [searchedCourseSettings, page, pageSize],
  )

  return (
    <div className={'flex flex-col gap-4'}>
      <div>
        <Input
          placeholder={'Search for courses'}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(event) => setSearch(event.target.value ?? '')}
          className="my-3"
        />
        <Pagination
          style={{ float: 'right' }}
          current={page}
          pageSize={pageSize}
          total={searchedCourseSettings!.length}
          onChange={(page) => setPage(page)}
          showSizeChanger={false}
        />
      </div>
      <div className={'flex w-full flex-row flex-wrap justify-center'}>
        {paginatedCourseSettings?.map((c: CourseChatbotSettings, i) => {
          const keys: (keyof CourseChatbotSettings)[] = [
            'llmId',
            'prompt',
            'temperature',
            'topK',
            'similarityThresholdDocuments',
          ]
          const usingDefaultKeys: Record<string, string> = {}
          keys.forEach((k) => {
            if (k == 'llmId') {
              usingDefaultKeys[k] = 'usingDefaultModel'
            } else {
              const s = k as string
              usingDefaultKeys[k] =
                `usingDefault${s.substring(0, 1).toUpperCase()}${s.substring(1)}`
            }
          })
          const titles = keys.map((k) => {
            const s = k as string
            if (k == 'llmId') {
              return 'LLM'
            }
            const uppercaseIndices: number[] = []
            for (let i = 0; i < s.length; i++) {
              if (s.charAt(i).match(/[A-Z]/g)) {
                uppercaseIndices.push(i)
              }
            }
            let str = s.substring(0, 1).toUpperCase() + s.substring(1)
            if (uppercaseIndices.length == 0) {
              return str
            } else {
              str =
                s.substring(0, 1).toUpperCase() +
                s.substring(1, uppercaseIndices[0])
              for (let i = 0; i < uppercaseIndices.length; i++) {
                str +=
                  ' ' +
                  s.substring(
                    uppercaseIndices[i],
                    i + 1 < uppercaseIndices.length
                      ? uppercaseIndices[i + 1]
                      : undefined,
                  )
              }
              return str
            }
          })
          const model: LLMType | undefined = modelList.find(
            (m) => m.id == c.llmId,
          )

          return (
            <div
              className={cn(pageSize % 2 == 0 ? 'w-1/2' : 'w-1/3', 'p-2')}
              key={`course-setting-${i}`}
            >
              <Card
                title={
                  c.course ? (
                    <div className={'flex justify-between gap-2'}>
                      <span className={'w-full truncate text-left'}>
                        {c.course.name}
                      </span>
                      <span className={'text-right'}>({c.course.id})</span>
                    </div>
                  ) : (
                    'Course Chatbot Setting'
                  )
                }
              >
                <div className={'flex w-full flex-col gap-2'}>
                  <div className={'w-full'}>
                    <div className={'flex flex-col justify-center gap-1'}>
                      {titles.map((t, j) => {
                        const k = keys[j]
                        return (
                          <div
                            key={`course-setting-atr-${i}-${j}`}
                            className={
                              'grid grid-cols-3 gap-2 border-b-2 border-b-gray-100 py-1 text-xs'
                            }
                          >
                            <div
                              className={'flex justify-between font-semibold'}
                            >
                              <div className={'w-full text-wrap'}>{t}</div>
                              <div>:</div>
                            </div>
                            <div
                              className={
                                'col-span-2 flex items-center justify-between gap-2'
                              }
                            >
                              {k == 'llmId' ? (
                                <div>{model?.modelName ?? 'Untracked LLM'}</div>
                              ) : (
                                <div>
                                  {
                                    c[
                                      k as keyof CourseChatbotSettings
                                    ] as string
                                  }
                                </div>
                              )}
                              <Tooltip
                                title={
                                  c[
                                    usingDefaultKeys[
                                      k
                                    ] as keyof CourseChatbotSettings
                                  ]
                                    ? 'This parameter is synchronized with the organization settings.'
                                    : 'This parameter is not synchronized with the organization settings.'
                                }
                              >
                                {c[
                                  usingDefaultKeys[
                                    k
                                  ] as keyof CourseChatbotSettings
                                ] ? (
                                  <StarFilled
                                    className={'text-helpmeblue text-sm'}
                                  />
                                ) : (
                                  <StarOutlined
                                    className={'text-sm text-gray-500'}
                                  />
                                )}
                              </Tooltip>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <Button
                      icon={<EditOutlined />}
                      type={'primary'}
                      color={'primary'}
                      onClick={() => setEditingSettings(c)}
                      className={'w-full'}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )
        })}
      </div>
      {editingSettings != undefined && (
        <ChatbotSettingsModal
          courseId={(editingSettings as any).courseId}
          onClose={cancelUpdate}
          open={!!editingSettings}
          updateCourseSettings={(sets) => onUpdate(sets)}
          preLoadedCourseSettings={courseSettingsInstances.find(
            (c) => c.courseId == (editingSettings as any).courseId,
          )}
          preLoadedProviders={organizationSettings.providers}
        />
      )}
    </div>
  )
}

export default CourseSettingTable
