'use client'

import { useLtiCourse } from '@/app/contexts/LtiCourseContext'
import UpsertIntegrationModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/lms_integrations/components/UpsertIntegrationModal'
import {
  CoursePartial,
  LMSApiResponseStatus,
  LMSCourseIntegrationPartial,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  OrganizationSettingsResponse,
} from '@koh/common'
import React, { useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { Button, Card, message, Modal } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useSessionStorage } from '@/app/hooks/useSessionStorage'

export default function LtiIntegrationPage(): React.ReactElement {
  const [lmsInfo] = useSessionStorage<{
    platform: LMSIntegrationPlatform
    apiCourseId: string
  }>('lms_info', null)

  const { platform, apiCourseId } = useMemo(() => {
    if (lmsInfo) {
      return lmsInfo
    } else {
      return {
        platform: undefined,
        apiCourseId: undefined,
      }
    }
  }, [lmsInfo])

  const [submitFlag, setSubmitFlag] = useSessionStorage<boolean>(
    'submit_lms_integration',
    false,
  )

  useEffect(() => {
    if (submitFlag) {
      message.info(
        `Ensure you click the "Integrate with ${platform}" or "Update existing integration" button and submit the shown form with your new token!`,
        10,
      )
      setSubmitFlag(false)
    }
  }, [])

  const { courseId, course } = useLtiCourse()

  const [modalOpen, setModalOpen] = useState(false)
  const [delModalOpen, setDelModalOpen] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [orgIntegration, setOrgIntegration] =
    useState<LMSOrganizationIntegrationPartial>()
  const [integrationOptions, setIntegrationOptions] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [courseIntegration, setCourseIntegration] =
    useState<LMSCourseIntegrationPartial>()
  const [integrationExists, setIntegrationExists] = useState(false)
  const [updateFlag, setUpdateFlag] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)

  useEffect(() => {
    const getIntegrations = () => {
      API.lmsIntegration
        .getCourseOrganizationIntegrations(courseId)
        .then((res) => {
          setOrgIntegration(res.find((v) => v.apiPlatform == platform))
          setIntegrationOptions(res)
        })
        .catch(() => {})

      API.lmsIntegration
        .getCourseIntegration(courseId)
        .then((res) => {
          if (res) {
            setCourseIntegration(res)
            setIntegrationExists(true)
          } else {
            setCourseIntegration({
              courseId,
              course: course as CoursePartial,
              apiPlatform: (platform as LMSIntegrationPlatform) ?? undefined,
              apiCourseId: apiCourseId ?? '',
              accessTokenId: undefined,
              lmsSynchronize: false,
              isExpired: false,
              hasApiKey: false,
              apiKeyExpiry: undefined,
            } satisfies LMSCourseIntegrationPartial)
            setIntegrationExists(false)
          }
        })
        .catch(() => {})
    }
    getIntegrations()
  }, [platform, apiCourseId, updateFlag])

  const testLMSConnection = async (
    apiCourseId: string,
    apiPlatform: LMSIntegrationPlatform,
    apiKey?: string,
    accessTokenId?: number,
  ) => {
    if (accessTokenId == undefined) {
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

  const deleteIntegration = async () => {
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

  if (!courseIntegration) {
    return <CenteredSpinner tip={'Loading...'} />
  }

  if (!lmsInfo) {
    return (
      <div
        className={
          'flex h-full w-full flex-row items-center justify-center p-20'
        }
      >
        <MiniAlert
          alertType={'warning'}
          title={'Missing necessary information to display this page!'}
          description={
            <div className={'flex flex-col items-center gap-1'}>
              <p>
                When this page is loaded following an LTI launch, the necessary
                parameters will be available.
              </p>
              <p>
                If it is launched in a normal browser session of HelpMe, these
                parameters will be missing.
              </p>
              <p>
                It is likely this page was accessed after using the LTI login
                entrypoint in a normal browser session.
              </p>
              <p>
                You will need to log out of the application and re-authenticate
                to start a proper session.
              </p>
              <a href={`/api/v1/logout`}>Logout</a>
            </div>
          }
        />
      </div>
    )
  }

  const onTokenGenerate = async () => {
    setGeneratingToken(true)
  }

  if (generatingToken) {
    return (
      <div
        className={
          'flex h-full w-full flex-row items-center justify-center md:p-20'
        }
      >
        <Card
          className={'w-full md:max-w-[75%] lg:max-w-[50%]'}
          classNames={{
            header: 'text-center',
          }}
          title={<h2>Action Required</h2>}
        >
          <div
            className={
              'flex flex-col items-center justify-center gap-8 text-xl'
            }
          >
            <p>A new window was opened with the token generation request!</p>
            <p>
              Please navigate to the newly opened window and finish the login
              with {platform} to authorize HelpMe to access your {platform}{' '}
              course information.
            </p>
            <p>
              If you&#39;re already finished authorizing HelpMe with {platform},
              you can reload this page by clicking the button below.
            </p>
            <Button
              onClick={() => {
                setSubmitFlag(true)
                window.location.reload()
              }}
              className={'p-6 text-lg font-semibold'}
              variant={'solid'}
              color={'primary'}
              icon={<SyncOutlined />}
            >
              Reload Page
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <>
      <UpsertIntegrationModal
        isOpen={modalOpen}
        setIsOpen={setModalOpen}
        organizationSettings={
          {
            organizationId: -1,
            allowProfCourseCreate: false,
            allowLMSApiKey: false,
          } satisfies OrganizationSettingsResponse
        }
        courseId={courseId}
        baseIntegration={courseIntegration}
        integrationOptions={integrationOptions}
        selectedIntegration={orgIntegration}
        setSelectedIntegration={() => undefined}
        isTesting={isTesting}
        testLMSConnection={testLMSConnection}
        onCreate={() => setUpdateFlag(!updateFlag)}
        lockApiCourseId={apiCourseId}
        lti={true}
        onTokenGenerate={onTokenGenerate}
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
      <Card
        classNames={{ body: 'flex w-full flex-col gap-8' }}
        title={
          <h1 className={'text-center text-lg md:text-2xl'}>
            Learning Management System Integration
          </h1>
        }
      >
        {(integrationExists && (
          <>
            {courseIntegration.apiPlatform != platform ? (
              <MiniAlert
                alertType={'error'}
                title={'Platform Mismatch'}
                description={`This course has an existing integration, but it is with ${courseIntegration.apiPlatform} and not ${platform}.`}
              />
            ) : (
              <MiniAlert
                alertType={'success'}
                title={'Integration Exists'}
                description={`This course has an existing integration with ${platform}.`}
              />
            )}
          </>
        )) || (
          <MiniAlert
            alertType={'warning'}
            title={'No Integration'}
            description={`This course does not have an existing integration with any platforms, including ${platform}.`}
          />
        )}
        <Card
          variant={'borderless'}
          title={<h2>Actions</h2>}
          className={'max-w-3/4 self-center'}
          classNames={{ body: 'flex flex-col gap-4 items-center' }}
        >
          <div className={'text-md flex flex-col justify-center gap-1'}>
            <p>
              By integrating a course with a learning management system, you can
              enable documents to be retrieved by HelpMe automatically. These
              will be used to build your course chatbot&#39;s knowledge base.
            </p>
            <p>
              Other benefits include being able to view which students from your
              course do not have a corresponding enrollment on the LMS.
            </p>
            {!orgIntegration ? (
              <>
                <p className={'font-semibold'}>
                  The organization this course belongs to does not contain any
                  learning management system configurations which match{' '}
                  {platform}.
                </p>
                <p className={'font-semibold'}>
                  If you wish to integrate this course with a learning
                  management system, contact your organization administrator.
                </p>
              </>
            ) : !integrationExists ? (
              <p>You can create a new integration for this course.</p>
            ) : (
              <>
                <p>
                  You can update the existing integration for this course, or
                  remove it entirely.
                </p>
                {courseIntegration.apiCourseId != apiCourseId && (
                  <MiniAlert
                    alertType={'warning'}
                    title={`${platform} Course Mismatch`}
                    description={`
                    This course from ${courseIntegration.apiPlatform} does not match the course this LTI tool
                    launched for: it has course ID ${courseIntegration.apiCourseId}, but this tool launched for course
                    ID ${apiCourseId}.
                    
                    Be careful modifying this integration as it could result in a temporary loss of documents if
                    it's not meant to be integrated with this ${platform} course!
                    `}
                  />
                )}
              </>
            )}
          </div>
          <div className={'flex w-min flex-col gap-2'}>
            <Button
              type={'primary'}
              icon={
                !integrationExists ? <PlusCircleOutlined /> : <EditOutlined />
              }
              onClick={() => {
                setModalOpen(true)
              }}
            >
              {!integrationExists
                ? `Integrate with ${platform}`
                : `Update existing integration`}
            </Button>
            {integrationExists && (
              <Button
                type={'primary'}
                icon={<DeleteOutlined />}
                danger
                onClick={() => setDelModalOpen(true)}
              >
                Delete integration
              </Button>
            )}
          </div>
        </Card>
      </Card>
    </>
  )
}

const MiniAlert: React.FC<{
  alertType: 'error' | 'warning' | 'success' | 'info'
  title?: React.ReactNode
  description?: React.ReactNode
}> = ({ alertType, title, description }) => {
  const color = (() => {
    switch (alertType) {
      case 'success':
        return `border-green-500 bg-green-100 text-green-700`
      case 'warning':
        return `border-yellow-500 bg-yellow-50 text-yellow-700`
      case 'error':
        return `border-red-500 bg-red-100 text-red-700`
      default:
        return `border-blue-500 bg-blue-100 text-blue-700`
    }
  })()

  return (
    <div
      className={cn(
        color,
        'flex flex-col gap-2 rounded-md border-2 p-4 shadow-md',
      )}
    >
      {title != undefined && (
        <span className={'text-lg font-semibold'}>{title}</span>
      )}
      {description != undefined && (
        <span className={'text-md'}>{description}</span>
      )}
    </div>
  )
}
