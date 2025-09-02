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
  Role,
} from '@koh/common'
import React, { useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { cn, getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { Button, Card, message, Modal } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'
import { usePathname, useRouter } from 'next/navigation'
import { useSessionStorage } from '@/app/hooks/useSessionStorage'

export default function LtiIntegrationPage(): React.ReactElement {
  const router = useRouter()
  const pathname = usePathname()

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

  const { userInfo } = useUserInfo()
  const { courseId, course } = useLtiCourse()
  const role = getRoleInCourse(userInfo, courseId)

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
        .catch((err) => {})

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
        .catch((err) => {})
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

  if (![Role.PROFESSOR].includes(role)) {
    router.push(`/lti/${courseId}`)
  }

  if (!courseIntegration || !platform || !apiCourseId) {
    return <CenteredSpinner tip={'Loading...'} />
  }

  const onTokenGenerate = async () => {
    setGeneratingToken(true)
  }

  if (generatingToken) {
    return (
      <div
        className={
          'flex h-full w-full flex-row items-center justify-center p-20'
        }
      >
        <Card
          classNames={{
            header: 'hidden',
          }}
        >
          <div
            className={
              'mt-20 flex flex-col items-center justify-center gap-8 text-xl'
            }
          >
            <p>A new window was opened with the token generation request!</p>
            <p>
              Please navigate to this window and finish the login to authorize
              HelpMe.
            </p>
            <p>
              If you're finished generating the token, you can reload this page
              by clicking the button below.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className={'mt-16 p-8 text-lg'}
            >
              Reload Page
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={'mt-4 flex flex-col gap-8'}>
      <h1>Learning Management System Integration</h1>
      {integrationExists && (
        <div
          className={cn(
            courseIntegration.apiPlatform != platform
              ? 'border-red-500 bg-red-100 text-red-700'
              : 'border-green-500 bg-green-100 text-green-700',
            'rounded-md border-2 p-4 shadow-md',
          )}
        >
          {courseIntegration.apiPlatform != platform ? (
            <span>
              This course has an existing integration, but it's for a different
              platform.
            </span>
          ) : (
            <span>
              This course has an existing integration for this platform!
            </span>
          )}
        </div>
      )}
      <Card
        title={'Actions'}
        classNames={{ body: 'flex flex-col gap-4 items-center' }}
      >
        <div className={'flex flex-col justify-center gap-1'}>
          {!integrationExists ? (
            <p className={'font-semibold text-green-600'}>
              This course is not integrated with a learning management system.
            </p>
          ) : (
            <p className={'font-semibold text-red-600'}>
              This course is already integrated with a learning management
              system.
            </p>
          )}
          <p>
            By integrating a course with a learning management system, you can
            enable documents to be retrieved by HelpMe automatically. These will
            be used to build your course chatbot's knowledge base.
          </p>
          <p>
            Other benefits include being able to view which students from your
            course do not have a corresponding enrollment on the LMS.
          </p>
          {!orgIntegration ? (
            <>
              <p className={'font-semibold'}>
                The organization this course belongs to does not contain any
                learning management system configurations which match {platform}
                .
              </p>
              <p className={'font-semibold'}>
                If you wish to integrate this course with a learning management
                system, contact your organization administrator.
              </p>
            </>
          ) : !integrationExists ? (
            <p>You can create a new integration for this course.</p>
          ) : (
            <p>
              You can update the existing integration for this course, or remove
              it entirely.
            </p>
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
    </div>
  )
}
