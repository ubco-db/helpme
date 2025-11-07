'use client'

import { Button, Result } from 'antd'
import { ReactElement, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { setProfInviteCookie } from '@/app/api/cookieApi'
import { API } from '@/app/api'
import { useRouter } from 'next/router'
import { getErrorMessage } from '@/app/utils/generalUtils'

type ProfInvitePageProps = {
  params: { piid: string } // piid stands for Prof Invite ID
}

export default function ProfInvitePage(
  props: ProfInvitePageProps,
): ReactElement {
  const searchParams = useSearchParams()
  const profInviteCode = searchParams.get('code') || ''
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // accept the invite right away if logged in.
    API.profile
      .index()
      .then(async (userInfo) => {
        await API.course.acceptProfInvite(Number(props.params.piid), {
          code: profInviteCode,
        })
      })
      .catch(async () => {
        // If not logged in, set cookies and redirect to /login
        await API.course
          .getProfInviteDetails(Number(props.params.piid))
          .then(async (details) => {
            await setProfInviteCookie(
              Number(props.params.piid),
              details.orgId,
              details.courseId,
              profInviteCode,
            )
              .then(() => {
                router.push(`/login`)
              })
              .catch((err) => {
                setErrorMessage(getErrorMessage(err))
              })
          })
          .catch((err) => {
            setErrorMessage(getErrorMessage(err))
          })
      })
  }, [])

  if (errorMessage) {
    return (
      <Result
        title="Error"
        subTitle={`Sorry, there was an error accepting the professor invite: ${errorMessage}`}
        extra={
          <Link href="/login">
            <Button type="primary">Back to Login</Button>
          </Link>
        }
      />
    )
  } else {
    return <CenteredSpinner tip="Loading..." />
  }
}
