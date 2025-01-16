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
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import { PenBoxIcon, RefreshCwIcon, TrashIcon } from 'lucide-react'
import LMSRosterTable from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSRosterTable'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useCourseLmsIntegration } from '@/app/hooks/useCourseLmsIntegration'
import LMSDocumentList from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/LMSDocumentList'

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

  const [updateFlag, setUpdateFlag] = useState<boolean>(false)
  const {
    integration,
    course,
    assignments,
    setAssignments,
    announcements,
    setAnnouncements,
    students,
    isLoading,
  } = useCourseLmsIntegration(courseId, updateFlag)

  const [lmsIntegrations, setLmsIntegrations] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [selectedIntegration, setSelectedIntegration] = useState<
    LMSOrganizationIntegrationPartial | undefined
  >(undefined)

  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [delModalOpen, setDelModalOpen] = useState<boolean>(false)
  const [isTesting, setIsTesting] = useState<boolean>(false)

  const fetchOrgIntegrationsAsync = useCallback(async () => {
    await API.lmsIntegration
      .getOrganizationIntegrations(organizationId)
      .then((response) => {
        if (response) setLmsIntegrations(response)
        else setLmsIntegrations([])
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }, [organizationId])

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
      .catch((error) => {
        message.error(getErrorMessage(error))
        return LMSApiResponseStatus.Error
      })

    switch (response) {
      case LMSApiResponseStatus.Success:
        message.success(response)
        break
      case LMSApiResponseStatus.Error:
        message.error(response)
        break
      default:
        message.warning(response)
        break
    }
    setIsTesting(false)
    return response
  }

  useEffect(() => {
    fetchOrgIntegrationsAsync()
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
      })
      .finally(() => {
        setUpdateFlag(!updateFlag)
      })
  }

  if (integration == undefined || course == undefined) {
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
            courseId={courseId}
            documents={assignments}
            loadingLMSData={isLoading}
            updateCallback={(new_assignments: LMSAssignment[]) => {
              setAssignments((prev) => {
                const updated: LMSAssignment[] = []
                for (const a of prev) {
                  const corresponding = new_assignments.find(
                    (a0) => a0.id == a.id,
                  )
                  if (corresponding == undefined) {
                    updated.push(a)
                  } else {
                    updated.push(corresponding)
                  }
                }
                return updated
              })
            }}
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
            courseId={courseId}
            documents={announcements}
            loadingLMSData={isLoading}
            updateCallback={(new_announcements: LMSAnnouncement[]) => {
              setAnnouncements((prev) => {
                const updated: LMSAnnouncement[] = []
                for (const a of prev) {
                  const corresponding = new_announcements.find(
                    (a0) => a0.id == a.id,
                  )
                  if (corresponding == undefined) {
                    updated.push(a)
                  } else {
                    updated.push(corresponding)
                  }
                }
                return updated
              })
            }}
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
          {!integration.isExpired && (
            <>
              <Descriptions layout={'vertical'} bordered={true}>
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
