'use client'

import { Button, message, QRCode, Result, Switch } from 'antd'
import { ReactElement, Suspense, useCallback, useEffect, useState } from 'react'
import { PublicQueueInvite } from '@koh/common'
import { API } from '@/app/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { getErrorMessage } from '@/app/utils/generalUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'

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
      <div className="mt-2 flex flex-col items-center justify-center gap-y-2 md:mt-5">
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
        <p>Public queue invite details: {JSON.stringify(queueInviteInfo)}</p>
        {projectorModeEnabled ? (
          <QRCode
            errorLevel={queueInviteInfo.QRCodeErrorLevel}
            value={inviteURL}
            icon="/helpme_logo_small.png"
          />
        ) : (
          <Button type="primary">Join Queue</Button>
        )}
        <Switch
          checkedChildren=""
          unCheckedChildren="Toggle Projector Mode"
          onChange={(checked) => setProjectorModeEnabled(checked)}
        />
      </div>
    )
  }
}
