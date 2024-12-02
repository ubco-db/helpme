'use client'

import { Button, Card, Descriptions, List, message, Modal, Table } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LMSApiResponseStatus,
  LMSAssignmentAPIResponse,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSIntegration,
  LMSOrganizationIntegrationPartial,
  Role,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import CourseRosterTable from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/CourseRosterTable'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import { PenBoxIcon, TrashIcon } from 'lucide-react'

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

  const [course, setCourse] = useState<LMSCourseAPIResponse>(
    {} as LMSCourseAPIResponse,
  )
  const [lmsStudents, setLmsStudents] = useState<string[]>([])
  const [assignments, setAssignments] = useState<LMSAssignmentAPIResponse[]>([])

  const fetchOrgIntegrationsAsync = useCallback(async () => {
    const response = await API.organizations.getIntegrations(organizationId)
    setLmsIntegrations(response)
  }, [organizationId])

  const fetchDataAsync = useCallback(async () => {
    const response = await API.course.getIntegration(courseId)
    setLmsIntegration(response)

    if (response != undefined) {
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
      <Card title={'Learning Management System'}>
        <div
          className={
            'flex flex-col justify-start gap-2 text-lg md:flex-row md:justify-between'
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
                management systems.
              </p>
            )}
          </div>
          {lmsIntegrations.length > 0 && (
            <>
              <List
                className={'p-4'}
                bordered={true}
                header={
                  <p className={'text-center text-xl'}>
                    Organization LMS Integrations
                  </p>
                }
                dataSource={lmsIntegrations}
                renderItem={(
                  orgIntegration: LMSOrganizationIntegrationPartial,
                ) => (
                  <Button
                    className={'w-full'}
                    onClick={() => {
                      setSelectedIntegration(orgIntegration)
                      setModalOpen(true)
                    }}
                  >
                    {orgIntegration.apiPlatform}
                  </Button>
                )}
              ></List>
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
            </>
          )}
        </div>
      </Card>
    )
  } else {
    return (
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
                  'border-helpmeblue text-helpmeblue md:hover:bg-helpmeblue md:hover:border-helpmeblue border-2 bg-white p-4 transition-all md:hover:text-white'
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
                Edit <PenBoxIcon />
              </Button>
              <Button
                className={
                  'border-2 border-red-500 bg-white p-4 text-red-500 transition-all md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-white'
                }
                onClick={() => {
                  setDelModalOpen(true)
                }}
              >
                Delete <TrashIcon />
              </Button>
            </div>
          </div>
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
          <CourseRosterTable
            courseId={courseId}
            role={Role.STUDENT}
            listTitle={'Course Students'}
            displaySearchBar={true}
            searchPlaceholder={'Search for Students'}
            disableRoleChange={true}
            onRoleChange={() => undefined}
            updateFlag={false}
            lmsStudents={lmsStudents}
            lmsPlatform={lmsIntegration.apiPlatform}
            loadingLMSData={isLoading}
          />
          {assignments.length > 0 && (
            <>
              <div
                className={'text-lg font-semibold'}
              >{`Course Assignments`}</div>
              <Table dataSource={assignments} loading={isLoading} bordered>
                <Table.Column dataIndex={'name'} title={'Assignment Name'} />
                <Table.Column dataIndex={'id'} title={'ID'} />
                <Table.Column
                  dataIndex={'modified'}
                  title={'Modified'}
                  render={(modified: string) => (
                    <span>{new Date(modified).toLocaleDateString()}</span>
                  )}
                />
                <Table.Column
                  dataIndex={'description'}
                  title={'Description'}
                  render={(description: string) => (
                    <div
                      dangerouslySetInnerHTML={{ __html: description }}
                    ></div>
                  )}
                />
              </Table>
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
  }
}
