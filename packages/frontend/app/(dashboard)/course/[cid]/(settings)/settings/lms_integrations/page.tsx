'use client'

import {
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  List,
  message,
  Modal,
  Spin,
  Tabs,
  Tooltip,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import { PenBoxIcon, RefreshCwIcon, TrashIcon } from 'lucide-react'
import LMSRosterTable from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSRosterTable'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { useCourseLmsIntegration } from '@/app/hooks/useCourseLmsIntegration'
import LMSDocumentList from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSDocumentList'
import { DeleteOutlined, SyncOutlined } from '@ant-design/icons'

export default function CourseLMSIntegrationPage({
  params,
}: {
  params: { cid: string }
}) {
  const courseId = useMemo(() => Number(params.cid) ?? -1, [params.cid])

  const [updateFlag, setUpdateFlag] = useState<boolean>(false)
  const {
    integration,
    course,
    assignments,
    announcements,
    students,
    isLoading,
  } = useCourseLmsIntegration(courseId, updateFlag)

  const [lmsIntegrations, setLmsIntegrations] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [selectedIntegration, setSelectedIntegration] = useState<
    LMSOrganizationIntegrationPartial | undefined
  >(undefined)

  const [syncing, setSyncing] = useState<boolean>(false)

  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [delModalOpen, setDelModalOpen] = useState<boolean>(false)
  const [isTesting, setIsTesting] = useState<boolean>(false)

  const fetchOrgIntegrationsAsync = useCallback(async () => {
    await API.lmsIntegration
      .getCourseOrganizationIntegrations(courseId)
      .then((response) => {
        if (response) setLmsIntegrations(response)
        else setLmsIntegrations([])
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }, [courseId])

  const testLMSConnection = async (
    apiKey: string,
    apiCourseId: string,
    apiPlatform: LMSIntegrationPlatform,
  ) => {
    if (apiKey == undefined || apiKey.trim() == '') {
      message.warning('API Key is required')
      return LMSApiResponseStatus.Error
    }

    if (apiCourseId == undefined || apiCourseId.trim() == '') {
      message.warning('API Course ID is required')
      return LMSApiResponseStatus.Error
    }

    setIsTesting(true)
    const response = await API.lmsIntegration
      .testIntegration(courseId, {
        apiPlatform: apiPlatform,
        apiKey: apiKey,
        apiCourseId: apiCourseId,
      })
      .then((response) => {
        if (response == LMSApiResponseStatus.Success) message.success(response)
        else message.warning(response)
        return response
      })
      .catch((error) => {
        message.error(getErrorMessage(error))
        return LMSApiResponseStatus.Error
      })
    setIsTesting(false)
    return response
  }

  useEffect(() => {
    fetchOrgIntegrationsAsync().then()
  }, [fetchOrgIntegrationsAsync])

  const deleteIntegration = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    API.lmsIntegration
      .removeCourseIntegration(courseId, {
        apiPlatform: integration.apiPlatform,
      })
      .then((result) => {
        if (!result) {
          message.error(
            `Unknown error occurred, could not delete the LMS integration`,
          )
        } else if (result.includes('Success')) {
          message.success(result)
          setDelModalOpen(false)
        } else {
          message.error(result)
        }
        setUpdateFlag(!updateFlag)
      })
  }

  const toggleSync = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)

    API.lmsIntegration.toggleSync(courseId).then((result) => {
      if (!result) {
        message.error(
          `Unknown error occurred, could not enable synchronization with the LMS.`,
        )
      } else {
        message.success(result)
      }
      setSyncing(false)
      setUpdateFlag(!updateFlag)
    })
  }

  const forceSync = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)
    API.lmsIntegration.forceSync(courseId).then((result) => {
      if (!result) {
        message.error(
          `Unknown error occurred, could not force synchronization with the LMS.`,
        )
      } else {
        message.success(result)
      }
      setSyncing(false)
      setUpdateFlag(!updateFlag)
    })
  }

  const clearDocuments = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)
    API.lmsIntegration.clearDocuments(courseId).then((result) => {
      if (!result) {
        message.error(
          `Unknown error occurred, could not clear documents from the LMS.`,
        )
      } else {
        message.success(result)
      }
      setSyncing(false)
      setUpdateFlag(!updateFlag)
    })
  }

  const outOfDateDocumentsCount = useMemo(
    () =>
      assignments.filter((a) => {
        return (
          a.uploaded &&
          a.modified &&
          new Date(a.uploaded).getTime() < new Date(a.modified).getTime()
        )
      }).length +
      announcements.filter((a) => {
        return (
          a.uploaded &&
          a.modified &&
          new Date(a.uploaded).getTime() < new Date(a.modified).getTime()
        )
      }).length,
    [announcements, assignments],
  )

  if (isLoading) {
    return (
      <div className={'flex h-full w-full items-center justify-center'}>
        <Spin className={'text-nowrap'} size="large">
          <div className={'text-helpmeblue mt-16'}>Loading...</div>
        </Spin>
      </div>
    )
  }

  if (integration == undefined) {
    return (
      <div
        className={'flex h-full w-full flex-col items-center justify-center'}
      >
        <Card
          title={
            <span className={'text-center'}>Learning Management System</span>
          }
          className={'w-2/3'}
        >
          <div
            className={
              'flex flex-col items-center justify-start gap-2 text-center text-lg'
            }
          >
            <div className={'flex flex-col'}>
              <p>
                This course is not integrated with a learning management system.
              </p>
              {lmsIntegrations.length == 0 ? (
                <>
                  <p>
                    The organization this course belongs to does not contain any
                    learning management system configurations.
                  </p>
                  <p className={'font-semibold'}>
                    If you wish to integrate this course with a learning
                    management system, contact your organization administrator.
                  </p>
                </>
              ) : (
                <p className={'font-semibold'}>
                  You can integrate this course with any of the listed learning
                  management systems:
                </p>
              )}
            </div>
            <Divider className={'my-2'} />
            {lmsIntegrations.length > 0 && (
              <>
                <List
                  className={'w-1/2'}
                  dataSource={lmsIntegrations}
                  renderItem={(
                    orgIntegration: LMSOrganizationIntegrationPartial,
                    index,
                  ) => (
                    <Button
                      className={'flex w-full justify-start'}
                      onClick={() => {
                        setSelectedIntegration(orgIntegration)
                        setModalOpen(true)
                      }}
                    >
                      <span className={'text-left'}>{index + 1}.</span>
                      <div className={'flex-1 text-center'}>
                        {orgIntegration.apiPlatform}
                      </div>
                    </Button>
                  )}
                ></List>
              </>
            )}
            <UpsertIntegrationModal
              isOpen={modalOpen}
              setIsOpen={setModalOpen}
              courseId={courseId}
              integrationOptions={lmsIntegrations}
              selectedIntegration={selectedIntegration}
              setSelectedIntegration={setSelectedIntegration}
              isTesting={isTesting}
              testLMSConnection={testLMSConnection}
              onCreate={() => setUpdateFlag(!updateFlag)}
            />
          </div>
        </Card>
      </div>
    )
  } else {
    const tabItems = [
      {
        key: 'roster',
        label: 'Course Roster',
        children: (
          <LMSRosterTable
            courseId={courseId}
            lmsStudents={students}
            lmsPlatform={integration.apiPlatform}
            loadingLMSData={isLoading}
          />
        ),
      },
    ]
    if (assignments.length > 0) {
      tabItems.push({
        key: 'assignments',
        label: 'Course Assignments',
        children: (
          <LMSDocumentList<LMSAssignment>
            type={'Assignment'}
            documents={assignments}
            loadingLMSData={isLoading}
          />
        ),
      })
    }
    if (announcements.length > 0) {
      tabItems.push({
        key: 'announcements',
        label: 'Course Announcements',
        children: (
          <LMSDocumentList<LMSAnnouncement>
            type={'Announcement'}
            documents={announcements}
            loadingLMSData={isLoading}
          />
        ),
      })
    }
    const card = (
      <Card title={'Learning Management System'}>
        <div className={'flex flex-col gap-4'}>
          <div
            className={
              'flex flex-col text-lg font-semibold md:flex-row md:justify-between'
            }
          >
            <div>{`${integration.apiPlatform} API Connection`}</div>
            <div className={'grid grid-cols-2 gap-2'}>
              <Button
                className={
                  'border-helpmeblue md:hover:bg-helpmeblue md:hover:border-helpmeblue border-2 bg-white p-4 transition-all md:hover:text-white'
                }
                onClick={() => {
                  setSelectedIntegration(
                    lmsIntegrations.find(
                      (i) => i.apiPlatform == integration?.apiPlatform,
                    ),
                  )
                  setModalOpen(true)
                }}
              >
                {!integration.isExpired ? (
                  <span
                    className={
                      'text-helpmeblue flex w-full justify-between md:hover:text-white'
                    }
                  >
                    <p>Edit</p> <PenBoxIcon />
                  </span>
                ) : (
                  <span
                    className={
                      'text-helpmeblue flex w-full justify-between md:hover:text-white'
                    }
                  >
                    <p>Update</p> <RefreshCwIcon />
                  </span>
                )}
              </Button>
              <Button
                className={
                  'border-2 border-red-500 bg-white p-4 text-red-500 transition-all md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-white'
                }
                onClick={() => {
                  setDelModalOpen(true)
                }}
              >
                <p>Delete</p> <TrashIcon />
              </Button>
            </div>
          </div>
          {!integration.isExpired && course != undefined && (
            <>
              <div className={'grid grid-cols-5 gap-2'}>
                <div className={'col-span-3'}>
                  <Descriptions
                    size={'middle'}
                    layout={'vertical'}
                    bordered={true}
                  >
                    <Descriptions.Item label={'API Course ID'}>
                      {integration.apiCourseId}
                    </Descriptions.Item>
                    <Descriptions.Item label={'Course Name (Course Code)'}>
                      {course.name} ({course.code})
                    </Descriptions.Item>
                    <Descriptions.Item label={'Student Count'}>
                      {course.studentCount}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
                <div className={'col-span-2'}>
                  <Card title={'Synchronization Options'}>
                    <div className={'flex flex-col items-center gap-2'}>
                      <div className={'flex flex-row gap-2'}>
                        <Button
                          size={'large'}
                          variant={'outlined'}
                          color={
                            integration.lmsSynchronize ? 'danger' : 'default'
                          }
                          className={cn(
                            integration.lmsSynchronize
                              ? ''
                              : 'border-green-700 text-green-700 hover:border-green-500 hover:text-green-500',
                          )}
                          onClick={toggleSync}
                          loading={syncing}
                        >
                          {integration.lmsSynchronize ? 'Disable' : 'Enable'}{' '}
                          {integration.apiPlatform} Synchronization
                        </Button>
                      </div>
                      <div>
                        <Badge count={outOfDateDocumentsCount} showZero={false}>
                          <Tooltip
                            title={`Force sychronization of data with ${integration.apiPlatform}. If visible, the red badge indicates how many documents are observed to be out-of-date.`}
                          >
                            <Button
                              size={'large'}
                              shape={'round'}
                              variant={
                                integration.lmsSynchronize
                                  ? 'outlined'
                                  : 'dashed'
                              }
                              color={
                                integration.lmsSynchronize ? 'blue' : 'default'
                              }
                              icon={<SyncOutlined />}
                              disabled={!integration.lmsSynchronize}
                              onClick={forceSync}
                              loading={syncing && integration.lmsSynchronize}
                            >
                              Force Synchronization
                            </Button>
                          </Tooltip>
                        </Badge>
                      </div>
                      <div className={'mt-4 flex flex-col gap-2 text-gray-500'}>
                        <p>
                          By enabling synchronization with{' '}
                          {integration.apiPlatform}, documents will be imported
                          and used to tune Chatbot responses to student
                          questions.
                        </p>
                        <p>
                          By default, the documents will be updated once a day.
                          You can force synchronization at any time to update
                          documents at will.
                        </p>
                      </div>
                      <Tooltip
                        title={`Clear any documents imported from ${integration.apiPlatform}.`}
                      >
                        <Button
                          size={'large'}
                          shape={'round'}
                          variant={'outlined'}
                          color={'danger'}
                          icon={<DeleteOutlined />}
                          onClick={clearDocuments}
                          loading={syncing}
                        >
                          Clear Documents
                        </Button>
                      </Tooltip>
                    </div>
                  </Card>
                </div>
              </div>
              <Tabs defaultActiveKey={'roster'} items={tabItems} />
            </>
          )}
          <UpsertIntegrationModal
            isOpen={modalOpen}
            setIsOpen={setModalOpen}
            courseId={courseId}
            baseIntegration={integration}
            integrationOptions={lmsIntegrations}
            selectedIntegration={selectedIntegration}
            setSelectedIntegration={setSelectedIntegration}
            isTesting={isTesting}
            testLMSConnection={testLMSConnection}
            onCreate={() => setUpdateFlag(!updateFlag)}
          />
          <Modal
            title={'Are you sure you want to delete this LMS integration?'}
            open={delModalOpen}
            onOk={() => deleteIntegration()}
            onCancel={() => {
              setDelModalOpen(false)
            }}
            okText={'Delete Integration'}
            okButtonProps={{
              className:
                'bg-white border-2 border-red-500 text-red-500 md:hover:bg-red-500 md:hover:border-red-500 md:hover:text-white transition-all',
            }}
          >
            <p>
              This integration be deleted forever! You will need to remake the
              configuration later if you wish to use it again.
            </p>
          </Modal>
        </div>
      </Card>
    )
    return integration.isExpired ? (
      <Badge.Ribbon color={'red'} text={'API Key Expired'}>
        {card}
      </Badge.Ribbon>
    ) : (
      card
    )
  }
}
