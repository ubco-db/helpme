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
  Tabs,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LMSApiResponseStatus,
  LMSAssignmentAPIResponse,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSIntegration,
  LMSOrganizationIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import { PenBoxIcon, RefreshCwIcon, TrashIcon } from 'lucide-react'
import LMSRosterTable from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSRosterTable'
import LMSAssignmentList from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSAssignmentList'
import { getErrorMessage } from '@/app/utils/generalUtils'

export default function CourseLMSIntegrationPage({
  params,
}: {
  params: { cid: string }
}) {
  const { userInfo } = useUserInfo()
  const courseId = useMemo(() => Number(params.cid) ?? -1, [params.cid])
  const organizationId = useMemo(
    () => userInfo?.organization?.orgId ?? -1,
    [userInfo?.organization?.orgId],
  )

  const [lmsIntegrations, setLmsIntegrations] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [lmsIntegration, setLmsIntegration] = useState<
    LMSCourseIntegrationPartial | undefined
  >(undefined)
  const [selectedIntegration, setSelectedIntegration] = useState<
    LMSOrganizationIntegrationPartial | undefined
  >(undefined)

  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [delModalOpen, setDelModalOpen] = useState<boolean>(false)
  const [isTesting, setIsTesting] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isAPIKeyExpired, setIsAPIKeyExpired] = useState<boolean>(false)

  const [course, setCourse] = useState<LMSCourseAPIResponse>(
    {} as LMSCourseAPIResponse,
  )
  const [lmsStudents, setLmsStudents] = useState<string[]>([])
  const [assignments, setAssignments] = useState<LMSAssignmentAPIResponse[]>([])

  const fetchOrgIntegrationsAsync = useCallback(async () => {
    await API.organizations
      .getIntegrations(organizationId)
      .then((response) => {
        if (response != undefined) setLmsIntegrations(response)
        else setLmsIntegrations([])
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }, [organizationId])

  const fetchDataAsync = useCallback(async () => {
    const response = await API.course
      .getIntegration(courseId)
      .then((response) => {
        if (response != undefined) setLmsIntegration(response)
        return response
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })

    if (response != undefined) {
      if (
        response.apiKeyExpiry != undefined &&
        (response.apiKeyExpiry as unknown as string).trim() != '' &&
        new Date(response.apiKeyExpiry).getTime() < new Date().getTime()
      ) {
        setIsAPIKeyExpired(true)
        return
      }
      setIsAPIKeyExpired(false)
      setIsLoading(true)
      setCourse(await API.lmsIntegration.getCourse(courseId))
      setLmsStudents(await API.lmsIntegration.getStudents(courseId))
      setAssignments(await API.lmsIntegration.getAssignments(courseId))
      setIsLoading(false)
    } else {
      setCourse({} as any)
      setLmsStudents([])
      setAssignments([])
    }
  }, [courseId])

  const testLMSConnection = async (
    apiKey: string,
    apiCourseId: string,
    apiPlatform: LMSIntegration,
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
      .catch(() => {
        return LMSApiResponseStatus.Error
      })

    const text = (() => {
      switch (response) {
        case LMSApiResponseStatus.InvalidCourseId:
          return 'Specified API course ID was invalid.'
        case LMSApiResponseStatus.InvalidPlatform:
          return 'Specified API platform was invalid.'
        case LMSApiResponseStatus.InvalidKey:
          return 'Specified API key was invalid.'
        case LMSApiResponseStatus.InvalidConfiguration:
          return 'Specified LMS Configuration was invalid.'
        case LMSApiResponseStatus.Success:
          return 'Successfully connected to LMS.'
        case LMSApiResponseStatus.Error:
          return 'Error occurred. LMS connection failed.'
      }
    })()
    switch (response) {
      case LMSApiResponseStatus.Success:
        message.success(text)
        break
      case LMSApiResponseStatus.Error:
        message.error(text)
        break
      default:
        message.warning(text)
        break
    }
    setIsTesting(false)
    return response
  }

  useEffect(() => {
    fetchOrgIntegrationsAsync()
    fetchDataAsync()
  }, [fetchOrgIntegrationsAsync, fetchDataAsync])

  const deleteIntegration = async () => {
    if (lmsIntegration == undefined) {
      message.error('No integration was specified')
      return
    }

    API.course
      .removeIntegration(courseId, { apiPlatform: lmsIntegration.apiPlatform })
      .then((result) => {
        if (result == undefined) {
          message.error(
            `Unknown error occurred, could not delete the LMS integration`,
          )
        } else if (result.includes('Success')) {
          message.success(result)
          setDelModalOpen(false)
        } else {
          message.error(result)
        }
      })
      .finally(() => {
        fetchDataAsync()
      })
  }

  if (lmsIntegration == undefined) {
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
              onCreate={fetchDataAsync}
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
            lmsStudents={lmsStudents}
            lmsPlatform={lmsIntegration.apiPlatform}
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
          <LMSAssignmentList
            assignments={assignments}
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
            <div>{`${lmsIntegration.apiPlatform} API Connection`}</div>
            <div className={'grid grid-cols-2 gap-2'}>
              <Button
                className={
                  'border-helpmeblue md:hover:bg-helpmeblue md:hover:border-helpmeblue border-2 bg-white p-4 transition-all md:hover:text-white'
                }
                onClick={() => {
                  setSelectedIntegration(
                    lmsIntegrations.find(
                      (i) => i.apiPlatform == lmsIntegration?.apiPlatform,
                    ),
                  )
                  setModalOpen(true)
                }}
              >
                {!isAPIKeyExpired ? (
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
          {!isAPIKeyExpired && (
            <>
              <Descriptions layout={'vertical'} bordered={true}>
                <Descriptions.Item label={'API Course ID'}>
                  {lmsIntegration.apiCourseId}
                </Descriptions.Item>
                <Descriptions.Item label={'Course Name (Course Code)'}>
                  {course.name} ({course.code})
                </Descriptions.Item>
                <Descriptions.Item label={'Student Count'}>
                  {course.studentCount}
                </Descriptions.Item>
              </Descriptions>
              <Tabs defaultActiveKey={'roster'} items={tabItems} />
            </>
          )}
          <UpsertIntegrationModal
            isOpen={modalOpen}
            setIsOpen={setModalOpen}
            courseId={courseId}
            baseIntegration={lmsIntegration}
            integrationOptions={lmsIntegrations}
            selectedIntegration={selectedIntegration}
            setSelectedIntegration={setSelectedIntegration}
            isTesting={isTesting}
            testLMSConnection={testLMSConnection}
            onCreate={fetchDataAsync}
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
    return isAPIKeyExpired ? (
      <Badge.Ribbon color={'red'} text={'API Key Expired'}>
        {card}
      </Badge.Ribbon>
    ) : (
      card
    )
  }
}
