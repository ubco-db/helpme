'use client'

import { Button, message, QRCode, Result, Switch } from 'antd'
import { ReactElement, Suspense, useCallback, useEffect, useState } from 'react'
import { PublicQueueInvite, UBCOuserParam, User } from '@koh/common'
import { API } from '@/app/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { getErrorMessage } from '@/app/utils/generalUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { userApi } from '@/app/api/userApi'
import StandardPageContainer from '@/app/components/standardPageContainer'
import { cookies } from 'next/headers'
import { setQueueInviteCookie } from '@/app/api/cookieApi'

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

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()
      if (response.statusCode === 401) {
        return
      } else {
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
      <StandardPageContainer className="items-center gap-y-2">
        <title>{`HelpMe - Invitation to join '${queueInviteInfo.room}'`}</title>
        <h1>{queueInviteInfo.room}</h1>
        {queueInviteInfo.queueSize === 0 ? (
          <p>The queue is empty!</p>
        ) : (
          <p>
            There are currently {queueInviteInfo.queueSize} students in the
            queue.
          </p>
        )}
        <p>Queue ID: {qid}</p>
        <p>Code: {code}</p>
        <pre className="max-w-7xl text-wrap">
          Public queue invite details: {JSON.stringify(queueInviteInfo)}
        </pre>
        {projectorModeEnabled ? (
          <div className="flex flex-col items-center justify-center gap-y-1">
            <div className="font-bold">Scan to join queue:</div>
            <QRCode
              errorLevel={queueInviteInfo.QRCodeErrorLevel}
              value={inviteURL}
              icon="/helpme_logo_small.png"
            />
          </div>
        ) : (
          <Button
            type="primary"
            loading={hasGettingUserBeenResolved || isJoinButtonLoading}
            disabled={hasGettingUserBeenResolved}
            onClick={JoinQueueButtonClick}
          >
            Join Queue
          </Button>
        )}
        <Switch
          checkedChildren=""
          unCheckedChildren="Toggle Projector Mode"
          onChange={(checked) => setProjectorModeEnabled(checked)}
        />
      </StandardPageContainer>
    )
  }
}
