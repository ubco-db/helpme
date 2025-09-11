'use client'

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  GetProp,
  List,
  message,
  Modal,
  Row,
  Skeleton,
  Statistic,
  Tabs,
  Tooltip,
} from 'antd'
import React, { use, useCallback, useEffect, useMemo, useState } from 'react'
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSFile,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  SupportedLMSFileTypes,
} from '@koh/common'
import { API } from '@/app/api'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import LMSRosterTable from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSRosterTable'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { useCourseLmsIntegration } from '@/app/hooks/useCourseLmsIntegration'
import LMSDocumentList from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSDocumentList'
import {
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { useUserInfo } from '@/app/contexts/userContext'

export default function CourseLMSIntegrationPage(props: {
  params: Promise<{
    cid: string
    tab: 'assignment' | 'announcement' | 'page' | 'file' | undefined
  }>
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const { userInfo } = useUserInfo()
  const params = use(props.params)
  const pathName = usePathname()
  const courseId = useMemo(() => Number(params.cid) ?? -1, [params.cid])
  const tab = useMemo(() => searchParams.get('tab'), [searchParams])
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const organizationSettings = useOrganizationSettings(
    userInfo?.organization?.orgId ?? -1,
  )

  const [currentTab, setCurrentTab] = useState<
    'assignment' | 'announcement' | 'page' | 'file' | 'roster' | undefined
  >()

  const defaultTab = useMemo(() => {
    switch (tab) {
      case 'assignment':
      case 'announcement':
      case 'page':
      case 'file':
        return tab
      default:
        return 'roster'
    }
  }, [tab])

  useEffect(() => {
    if (!hasLoadedOnce) {
      setCurrentTab(defaultTab)
      setHasLoadedOnce(true)
    }
  }, [defaultTab, hasLoadedOnce])

  const getActiveTab = () => {
    return currentTab ?? defaultTab
  }

  const [updateFlag, setUpdateFlag] = useState<boolean>(false)
  const {
    integration,
    course,
    assignments,
    announcements,
    students,
    pages,
    files,
    isLoadingIntegration,
    isLoadingStudents,
    isLoadingAssignments,
    isLoadingAnnouncements,
    isLoadingFiles,
    isLoadingPages,
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
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [preselect, setPreselect] = useState<
    LMSIntegrationPlatform | undefined
  >()

  useEffect(() => {
    const success_msg = searchParams.get('success_message')
    const error_msg = searchParams.get('error_message')
    const platform = searchParams.get('platform')

    if (platform) {
      setPreselect(platform as LMSIntegrationPlatform)
    }

    if (success_msg) {
      message.success(success_msg, 3).then(() => {
        router.push(pathname)
      })
    } else if (error_msg) {
      message.error(error_msg, 3).then(() => {
        router.push(pathname)
      })
    } else {
      router.push(pathname)
    }
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (integration?.selectedResourceTypes) {
      setSelectedResources(integration.selectedResourceTypes)
    }
  }, [integration?.selectedResourceTypes])

  const onSelectedResourcesChange: GetProp<
    typeof Checkbox.Group,
    'onChange'
  > = (checkedValues) => {
    setSelectedResources(checkedValues as string[])
  }

  const hasSelectionChanged = useMemo(() => {
    if (!integration?.selectedResourceTypes) return false
    const currentSorted = [...selectedResources].sort()
    const dbSorted = [...integration.selectedResourceTypes].sort()
    if (currentSorted.length !== dbSorted.length) return true
    return currentSorted.some((item, index) => item !== dbSorted[index])
  }, [selectedResources, integration?.selectedResourceTypes])

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

  useEffect(() => {
    if (lmsIntegrations.length > 0 && preselect) {
      setSelectedIntegration(
        lmsIntegrations.find((v) => v.apiPlatform == preselect),
      )
      setModalOpen(true)
      setPreselect(undefined)
    }
  }, [preselect, lmsIntegrations])

  const testLMSConnection = async (
    apiCourseId: string,
    apiPlatform: LMSIntegrationPlatform,
    apiKey?: string,
    accessTokenId?: number,
  ) => {
    if (organizationSettings?.allowLMSApiKey) {
      if (
        accessTokenId == undefined &&
        (apiKey == undefined || apiKey.trim() == '')
      ) {
        message.warning('API Key or Access Token is required')
        return LMSApiResponseStatus.Error
      }
    } else if (accessTokenId == undefined) {
      message.warning('Access Token is required')
      return LMSApiResponseStatus.Error
    }

    if (apiCourseId == undefined || String(apiCourseId).trim() == '') {
      message.warning('API Course ID is required')
      return LMSApiResponseStatus.Error
    }

    setIsTesting(true)
    const response = await API.lmsIntegration
      .testIntegration(courseId, {
        apiPlatform: apiPlatform,
        apiKey: apiKey,
        accessTokenId: accessTokenId,
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
      .removeCourseIntegration(courseId)
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
      .catch((err) => message.error(getErrorMessage(err)))
  }

  const toggleSync = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)

    API.lmsIntegration
      .toggleSync(courseId)
      .then((result) => {
        if (!result) {
          message.error(
            `Unknown error occurred, could not enable synchronization with the LMS.`,
          )
        } else {
          message.success(result)
        }
        setUpdateFlag(!updateFlag)
      })
      .catch((err) => message.error(getErrorMessage(err)))
      .finally(() => setSyncing(false))
  }

  const forceSync = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)
    API.lmsIntegration
      .forceSync(courseId)
      .then((result) => {
        if (!result) {
          message.error(
            `Unknown error occurred, could not force synchronization with the LMS.`,
          )
        } else {
          if (result.errors > 0) {
            result.itemsSynced + result.itemsRemoved > 0
              ? message.warning(
                  `Force synchronization completed with warnings. ${result.errors < 10 ? result.errors : '9+'} item(s) could not by synced.`,
                  5,
                )
              : message.error(
                  'Force synchronization failed. Please try again later.',
                )
          } else {
            message.success(
              'Successfully forced synchronization with integrated course.',
            )
          }
        }
        setUpdateFlag(!updateFlag)
      })
      .catch((err) => message.error(getErrorMessage(err)))
      .finally(() => setSyncing(false))
  }

  const handleSaveAndResync = async () => {
    try {
      await API.lmsIntegration.updateSelectedResourceTypes(
        courseId,
        selectedResources as string[],
      )
      message.success('Resource types updated!')
      await forceSync()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const clearDocuments = async () => {
    if (integration == undefined) {
      message.error('No integration was specified')
      return
    }

    setSyncing(true)
    API.lmsIntegration
      .clearDocuments(courseId)
      .then((result) => {
        if (!result) {
          message.error(
            `Unknown error occurred, could not clear documents from the LMS.`,
          )
        } else {
          message.success(result)
        }
        setUpdateFlag(!updateFlag)
      })
      .catch((err) => message.error(getErrorMessage(err)))
      .finally(() => setSyncing(false))
  }

  const outOfDateDocumentsCount = useMemo(
    () =>
      [...assignments, ...announcements, ...pages, ...files].filter((a) => {
        return (
          a.uploaded &&
          a.modified &&
          new Date(a.uploaded).getTime() < new Date(a.modified).getTime()
        )
      }).length,
    [announcements, assignments, pages, files],
  )

  const savedDocumentsCount = useMemo(
    () =>
      [...assignments, ...announcements, ...pages, ...files].filter(
        (a) => a.uploaded != undefined,
      ).length,
    [announcements, assignments, pages, files],
  )

  const ableToSync = useMemo(
    () => [
      ...assignments.filter(
        (a) =>
          (a.description != undefined && a.description != '') ||
          a.due != undefined,
      ),
      ...announcements,
      ...pages,
      ...files,
    ],
    [announcements, assignments, pages, files],
  )

  const unableToSync = useMemo(
    () => [
      ...assignments.filter(
        (a) =>
          (a.description == undefined || a.description == '') &&
          a.due == undefined,
      ),
      ...announcements.filter((a) => !a),
      ...pages.filter((a) => !a),
      ...files.filter(
        (a) =>
          !a ||
          !(Object.values(SupportedLMSFileTypes) as string[]).includes(
            a.contentType,
          ),
      ),
    ],
    [assignments, announcements, pages, files],
  )

  const failedToSync = useMemo(
    () => ableToSync.filter((a) => a.uploaded == undefined),
    [ableToSync],
  )

  if (isLoadingIntegration || !organizationSettings) {
    return <CenteredSpinner tip={'Loading...'} />
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
              <p>
                By integrating a course with a learning management system, you
                can enable documents to be retrieved by HelpMe automatically.
                These will be used to build your course chatbot's knowledge
                base.
              </p>
              <p>
                Other benefits include being able to view which students from
                your course do not have a corresponding enrollment on the LMS.
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
              organizationSettings={organizationSettings}
            />
          </div>
        </Card>
      </div>
    )
  } else {
    const tabItems: Array<{
      key: string
      label: string | React.ReactNode
      children: React.ReactNode
    }> = [
      {
        key: 'roster',
        label: (
          <LMSTabLabel title={'Course Roster'} isLoading={isLoadingStudents} />
        ),
        children: (
          <LMSRosterTable
            courseId={courseId}
            lmsStudents={students}
            lmsPlatform={integration.apiPlatform}
            loadingLMSData={isLoadingStudents}
          />
        ),
      },
    ]
    if (assignments.length > 0 || isLoadingAssignments) {
      tabItems.push({
        key: 'assignment',
        label: (
          <LMSTabLabel
            title={'Course Assignments'}
            isLoading={isLoadingAssignments}
          />
        ),
        children: (
          <LMSDocumentList<LMSAssignment>
            courseId={courseId}
            type={'Assignment'}
            documents={assignments}
            loadingLMSData={isLoadingAssignments}
            lmsSynchronize={integration.lmsSynchronize}
            onUpdateCallback={() => setUpdateFlag(!updateFlag)}
            selectedResourceTypes={integration.selectedResourceTypes}
          />
        ),
      })
    }
    if (pages.length > 0 || isLoadingPages) {
      tabItems.push({
        key: 'page',
        label: (
          <LMSTabLabel title={'Course Pages'} isLoading={isLoadingPages} />
        ),
        children: (
          <LMSDocumentList<LMSPage>
            courseId={courseId}
            type={'Page'}
            documents={pages}
            loadingLMSData={isLoadingPages}
            lmsSynchronize={integration.lmsSynchronize}
            onUpdateCallback={() => setUpdateFlag(!updateFlag)}
            selectedResourceTypes={integration.selectedResourceTypes}
          />
        ),
      })
    }
    if (files.length > 0 || isLoadingFiles) {
      tabItems.push({
        key: 'file',
        label: (
          <LMSTabLabel title={'Course Files'} isLoading={isLoadingFiles} />
        ),
        children: (
          <LMSDocumentList<LMSFile>
            courseId={courseId}
            type={'File'}
            documents={files}
            loadingLMSData={isLoadingFiles}
            lmsSynchronize={integration.lmsSynchronize}
            onUpdateCallback={() => setUpdateFlag(!updateFlag)}
            selectedResourceTypes={integration.selectedResourceTypes}
          />
        ),
      })
    }
    if (announcements.length > 0 || isLoadingAnnouncements) {
      tabItems.push({
        key: 'announcement',
        label: (
          <Tooltip title="Also includes discussion posts written by instructors and TA's.">
            <LMSTabLabel
              title={'Course Announcements'}
              isLoading={isLoadingAnnouncements}
            />
          </Tooltip>
        ),
        children: (
          <LMSDocumentList<LMSAnnouncement>
            courseId={courseId}
            type={'Announcement'}
            documents={announcements}
            loadingLMSData={isLoadingAnnouncements}
            lmsSynchronize={integration.lmsSynchronize}
            onUpdateCallback={() => setUpdateFlag(!updateFlag)}
            selectedResourceTypes={integration.selectedResourceTypes}
          />
        ),
      })
    }

    const card = (
      <Card title={'Learning Management System Integration'}>
        <div className={'flex flex-col gap-4'}>
          <div
            className={
              'flex flex-col text-lg font-semibold md:flex-row md:justify-between'
            }
          >
            <div>{`${integration.apiPlatform} API Connection`}</div>
            <div className={'grid grid-cols-2 gap-2'}>
              <Button
                color={'blue'}
                variant={'outlined'}
                onClick={() => {
                  setSelectedIntegration(
                    lmsIntegrations.find(
                      (i) => i.apiPlatform == integration?.apiPlatform,
                    ),
                  )
                  setModalOpen(true)
                }}
                icon={
                  !integration.isExpired ? <EditOutlined /> : <SyncOutlined />
                }
              >
                {!integration.isExpired ? 'Edit' : 'Update'}
              </Button>
              <Button
                color={'danger'}
                variant={'outlined'}
                icon={<DeleteOutlined />}
                onClick={() => {
                  setDelModalOpen(true)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
          <Skeleton
            active
            loading={course == undefined || integration.isExpired}
          >
            <div className={'grid grid-cols-4 gap-2'}>
              <div className={'col-span-2 flex flex-col'}>
                <Card title={'Course Details'} className={'h-full'}>
                  <div className={'flex flex-col gap-4'}>
                    <Statistic
                      title={'API Course ID'}
                      groupSeparator={''}
                      value={integration.apiCourseId}
                    />
                    <Statistic title={'Course Name'} value={course?.name} />
                    <Statistic
                      title={'Student Count'}
                      value={course?.studentCount}
                      suffix={
                        (course?.studentCount ?? 0) > 1 ? 'students' : 'student'
                      }
                    />
                  </div>
                </Card>
              </div>
              <div className={'col-span-2 flex flex-col'}>
                <Card className={'h-full'}>
                  <Tabs
                    defaultActiveKey="1"
                    items={[
                      {
                        label: 'Synchronization Options',
                        key: '1',
                        children: (
                          <div className={'flex flex-col items-center gap-2'}>
                            <div className={'flex flex-row gap-2'}>
                              <Button
                                size={'large'}
                                variant={'outlined'}
                                color={
                                  integration.lmsSynchronize
                                    ? 'danger'
                                    : 'default'
                                }
                                className={cn(
                                  integration.lmsSynchronize
                                    ? ''
                                    : 'border-green-700 text-green-700 hover:border-green-500 hover:text-green-500',
                                )}
                                onClick={toggleSync}
                                loading={syncing}
                              >
                                {integration.lmsSynchronize
                                  ? 'Disable'
                                  : 'Enable'}{' '}
                                {integration.apiPlatform} Synchronization
                              </Button>
                            </div>
                            <div className={'mt-2'}>
                              <Badge
                                count={
                                  integration.lmsSynchronize
                                    ? outOfDateDocumentsCount +
                                      failedToSync.length
                                    : 0
                                }
                                showZero={false}
                              >
                                <Tooltip
                                  title={`Force synchronization of data with ${integration.apiPlatform}. If visible, the red badge indicates how many documents are observed to be out-of-date and how many documents are unsynchronized.`}
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
                                      integration.lmsSynchronize
                                        ? 'blue'
                                        : 'default'
                                    }
                                    icon={<SyncOutlined />}
                                    disabled={
                                      !integration.lmsSynchronize ||
                                      isLoadingIntegration ||
                                      isLoadingPages ||
                                      isLoadingAssignments ||
                                      isLoadingAnnouncements ||
                                      isLoadingStudents ||
                                      isLoadingFiles
                                    }
                                    onClick={forceSync}
                                    loading={
                                      syncing && integration.lmsSynchronize
                                    }
                                  >
                                    Force Synchronization
                                  </Button>
                                </Tooltip>
                              </Badge>
                            </div>
                            {integration.lmsSynchronize && (
                              <div
                                className={'flex flex-row items-center gap-1'}
                              >
                                {ableToSync.length - failedToSync.length >
                                  0 && (
                                  <Badge
                                    color={'green'}
                                    count={`${
                                      ableToSync.length - failedToSync.length <
                                      10
                                        ? ableToSync.length -
                                          failedToSync.length
                                        : '9+'
                                    } Synced`}
                                  />
                                )}
                                {unableToSync.length > 0 && (
                                  <Badge
                                    color={'yellow'}
                                    count={`${
                                      unableToSync.length < 10
                                        ? unableToSync.length
                                        : '9+'
                                    } Cannot Be Synced`}
                                  />
                                )}
                                {failedToSync.length > 0 && (
                                  <Badge
                                    color={'red'}
                                    count={`${
                                      failedToSync.length < 10
                                        ? failedToSync.length
                                        : '9+'
                                    } Not Synced`}
                                  />
                                )}
                              </div>
                            )}
                            <div
                              className={
                                'mt-4 flex flex-col gap-2 text-gray-500'
                              }
                            >
                              <p>
                                By enabling synchronization with{' '}
                                {integration.apiPlatform}, documents will be
                                imported and used to tune Chatbot responses to
                                student questions.
                              </p>
                              <p>
                                By default, the documents will be updated once a
                                day. You can force synchronization at any time
                                to update documents at will.
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
                                disabled={savedDocumentsCount < 1}
                              >
                                Clear Documents
                              </Button>
                            </Tooltip>
                          </div>
                        ),
                      },

                      {
                        label: 'Resource Selector',
                        key: '2',
                        children: (
                          <div className={'flex flex-col items-center gap-2'}>
                            <Checkbox.Group
                              style={{ width: '100%' }}
                              onChange={onSelectedResourcesChange}
                              value={selectedResources}
                            >
                              <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                  <Checkbox value="assignments">
                                    Assignments
                                  </Checkbox>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                  <Checkbox value="announcements">
                                    Announcements
                                  </Checkbox>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                  <Checkbox value="files">Files</Checkbox>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                  <Checkbox value="pages">Pages</Checkbox>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                  <Checkbox value="Syllabus" disabled={true}>
                                    <Tooltip title="Coming Soon!">
                                      <span className="text-gray-400 line-through">
                                        Syllabus
                                      </span>
                                    </Tooltip>
                                  </Checkbox>
                                </Col>
                              </Row>
                            </Checkbox.Group>
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
                              disabled={
                                !integration.lmsSynchronize ||
                                !hasSelectionChanged
                              }
                              style={{ marginTop: '30px' }}
                              onClick={handleSaveAndResync}
                              loading={syncing && integration.lmsSynchronize}
                              className="w-full sm:w-auto"
                            >
                              <span className="hidden sm:inline">
                                Save and Re-Sync Documents
                              </span>
                              <span className="sm:hidden">Save & Sync</span>
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            </div>
          </Skeleton>
          <Skeleton loading={integration.isExpired}>
            <Tabs
              destroyOnHidden
              defaultActiveKey={defaultTab}
              activeKey={getActiveTab()}
              onTabClick={(activeKey) => {
                router.push(pathName, { scroll: false })
                setCurrentTab(activeKey as any)
              }}
              items={tabItems}
            />
          </Skeleton>
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
            organizationSettings={organizationSettings}
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

const LMSTabLabel: React.FC<{ title: string; isLoading: boolean }> = ({
  title,
  isLoading,
}) => {
  return (
    <div className={'flex items-center justify-center gap-2'}>
      <span>{title}</span>
      {isLoading && <LoadingOutlined className={'text-xs'} spin />}
    </div>
  )
}
