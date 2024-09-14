'use client'

import { Button, message, QRCode, Result, Switch, Tooltip } from 'antd'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import { PublicQueueInvite, UBCOuserParam, User } from '@koh/common'
import { API } from '@/app/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { getErrorMessage } from '@/app/utils/generalUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { userApi } from '@/app/api/userApi'
import StandardPageContainer from '@/app/components/standardPageContainer'
import { setQueueInviteCookie } from '@/app/api/cookieApi'
import { StatusCard } from '@/app/(dashboard)/course/[cid]/queue/[qid]/components/StaffList'
import { createRoot } from 'react-dom/client'
import { useQuestionsWithQueueInvite } from '@/app/hooks/useQuestionsWithQueueInvite'

type QueueInvitePageProps = {
  params: { qid: string }
}

/**
 * NOTE: This is the QUEUE INVITES page.
 * The reason the folder is called `qi` is to shorten the URL so the QR code is easier to scan.
 */
export default function QueueInvitePage({
  params,
}: QueueInvitePageProps): ReactElement {
  const qid = Number(params.qid)
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = decodeURIComponent(searchParams.get('c') ?? '')
  const [projectorModeEnabled, setProjectorModeEnabled] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [hasFetchErrorOccurred, setHasFetchErrorOccurred] = useState(false)
  const [queueInviteInfo, setQueueInviteInfo] =
    useState<PublicQueueInvite | null>(null)
  const [profile, setProfile] = useState<User>()
  const [hasGettingUserBeenResolved, setHasGettingUserBeenResolved] =
    useState(false) // don't let the users hit the join button before we find out if they're logged in or not
  const [isJoinButtonLoading, setIsJoinButtonLoading] = useState(false)
  const { queueQuestions } = useQuestionsWithQueueInvite(
    qid,
    code,
    queueInviteInfo?.isQuestionsVisible,
  )

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()
      if (response.statusCode < 400) {
        setProfile(response)
      }
      setHasGettingUserBeenResolved(true)
    }
    fetchUserDetails()
  }, [])

  const isHttps =
    (typeof window !== 'undefined' && window.location.protocol) === 'https:'
  const baseURL =
    typeof window !== 'undefined'
      ? `${isHttps ? 'https' : 'http'}://${window.location.host}`
      : ''
  const inviteURL = queueInviteInfo
    ? `${baseURL}/qi/${queueInviteInfo.queueId}?c=${encodeURIComponent(queueInviteInfo.inviteCode)}`
    : ''

  const fetchPublicQueueInviteInfo = useCallback(async () => {
    try {
      const queueInviteInfo = await API.queueInvites.get(qid, code)
      setQueueInviteInfo(queueInviteInfo)
    } catch (error) {
      setHasFetchErrorOccurred(true)
    } finally {
      setPageLoading(false)
    }
  }, [qid, code])

  useEffect(() => {
    fetchPublicQueueInviteInfo()
  }, [fetchPublicQueueInviteInfo])

  const JoinQueueButtonClick = useCallback(async () => {
    if (!queueInviteInfo) {
      message.error('Queue invite info not loaded. Please try again')
      return
    }
    // if the user is already logged in and is in the course, redirect them to the queue
    if (
      profile &&
      profile.courses.some(
        (course) => course.course.id === queueInviteInfo.courseId,
      )
    ) {
      router.push(
        `/course/${queueInviteInfo.courseId}/queue/${queueInviteInfo.queueId}`,
      )
    } else if (
      profile &&
      profile.organization?.orgId !== queueInviteInfo.orgId
    ) {
      // if the user is not a part of this organization, log them out
      await setQueueInviteCookie(
        queueInviteInfo.queueId,
        queueInviteInfo.courseId,
        queueInviteInfo.orgId,
        queueInviteInfo.courseInviteCode,
      ).then(() => {
        router.push('/api/v1/logout')
      })
    } else if (profile && queueInviteInfo.willInviteToCourse) {
      // if the user is already logged in but not in the course (and willInviteToCourse is enabled), enroll them in the course
      setIsJoinButtonLoading(true)
      const userData: UBCOuserParam = {
        email: profile.email,
        selected_course: queueInviteInfo.courseId,
        organizationId: queueInviteInfo.orgId,
      }
      await API.course
        .enrollByInviteCode(userData, code)
        .then(() => {
          router.push(
            `/course/${queueInviteInfo.courseId}/queue/${queueInviteInfo.queueId}`,
          )
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Failed to enroll in course: ' + errorMessage)
        })
        .finally(() => {
          setIsJoinButtonLoading(false)
        })
    } else if (profile) {
      message.error('You must be a part of this course to use this invite')
    } else {
      // if the user is not logged in, set their cookies and then redirect them to the login page
      await setQueueInviteCookie(
        queueInviteInfo.queueId,
        queueInviteInfo.courseId,
        queueInviteInfo.orgId,
        queueInviteInfo.courseInviteCode,
      ).then(() => {
        router.push('/login')
      })
    }
  }, [code, queueInviteInfo, router, profile])

  const handlePrintQRCode = useCallback(() => {
    if (!queueInviteInfo) {
      message.error('Queue invite info not loaded. Please try again')
      return
    }
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>HelpMe | ${queueInviteInfo.room} QR Code (${queueInviteInfo.courseName})</title>
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;  }
              h1 { text-align: center; }
              .qrcode { display: flex; justify-content: center; flex-direction: column; align-items: center; }
            </style>
          </head>
          <body>
            <div class="qrcode">
              <h1>Scan to join ${queueInviteInfo.room} for ${queueInviteInfo.courseName}</h1>
              <div id="qrcode"></div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()

      const qrCodeContainer = printWindow.document.getElementById('qrcode')
      if (qrCodeContainer) {
        const qrCodeElement = (
          <QRCode
            errorLevel={queueInviteInfo.QRCodeErrorLevel}
            value={inviteURL}
            icon="/helpme_logo_small.png"
            size={400}
          />
        )
        const root = createRoot(qrCodeContainer)
        root.render(qrCodeElement)
      }

      printWindow.print()
    }
  }, [queueInviteInfo, inviteURL])

  if (pageLoading) {
    return <CenteredSpinner tip="Loading..." />
  } else if (hasFetchErrorOccurred) {
    return (
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the queue invite link you used is invalid or was removed."
        extra={
          <Link href="/login">
            <Button type="primary">Back to Login</Button>
          </Link>
        }
      />
    )
  } else if (!queueInviteInfo) {
    return <CenteredSpinner tip="Queue invite loading..." />
  } else {
    return (
      <StandardPageContainer className="h-full items-center gap-y-2">
        <title>{`HelpMe - Invitation to join ${queueInviteInfo.room} for ${queueInviteInfo.courseName}`}</title>
        <h1>
          {queueInviteInfo.room} | {queueInviteInfo.courseName}
        </h1>
        {queueInviteInfo.queueSize === 0 ? (
          <p>The queue is empty!</p>
        ) : (
          <p>
            There are currently{' '}
            <span className="font-bold">{queueInviteInfo.queueSize}</span>{' '}
            students in the queue.
          </p>
        )}
        <pre className="max-w-7xl text-wrap">
          Public queue invite details: {JSON.stringify(queueInviteInfo)}
        </pre>
        {projectorModeEnabled ? (
          <div className="flex flex-col items-center justify-center gap-y-1">
            <div className="font-bold">Scan to join queue:</div>
            <Tooltip title="Click this to print it">
              <QRCode
                errorLevel={queueInviteInfo.QRCodeErrorLevel}
                value={inviteURL}
                icon="/helpme_logo_small.png"
                onClick={handlePrintQRCode}
              />
            </Tooltip>
          </div>
        ) : (
          <Button
            type="primary"
            className="w-full md:w-40"
            loading={!hasGettingUserBeenResolved || isJoinButtonLoading}
            disabled={!hasGettingUserBeenResolved}
            onClick={JoinQueueButtonClick}
          >
            Join Queue
          </Button>
        )}
        <h2 className="text-lg">Staff</h2>
        {queueInviteInfo.staffList.length === 0 ? (
          <p>There are no staff members in this queue.</p>
        ) : (
          <div className="text-sm">
            {queueInviteInfo.staffList.map((ta) => (
              <StatusCard
                key={ta.id}
                taName={ta.name}
                taPhotoURL={ta.photoURL}
                helpedAt={ta.questionHelpedAt}
              />
            ))}
          </div>
        )}
        {queueInviteInfo.isQuestionsVisible && (
          <pre className="max-w-7xl text-wrap">
            Question Details: {JSON.stringify(queueQuestions)}
          </pre>
        )}
        <Switch
          className="mb-0 mt-auto"
          checkedChildren=""
          unCheckedChildren={
            queueInviteInfo.QRCodeEnabled
              ? 'Show QR Code'
              : 'Toggle Projector Mode'
          }
          onChange={(checked) => setProjectorModeEnabled(checked)}
        />
      </StandardPageContainer>
    )
  }
}
