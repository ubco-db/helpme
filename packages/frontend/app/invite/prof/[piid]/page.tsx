'use client'

import { Button, Result } from 'antd'
import { ReactElement, use, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { setProfInviteCookie } from '@/app/api/cookie-utils'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

type ProfInvitePageProps = {
  params: Promise<{ piid: string }> // piid stands for Prof Invite ID
}

export default function ProfInvitePage(
  props: ProfInvitePageProps,
): ReactElement {
  const params = use(props.params)
  const piid = Number(params.piid)
  const searchParams = useSearchParams()
  const profInviteCode = searchParams.get('c') || ''
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // accept the invite right away if logged in.
    API.profile
      .getUser()
      .then(async () => {
        // Instead of doing a GET and then giving a 302 redirect,
        // I opted to do a POST that returns the redirect url since that way I can hide the url inside the body
        // (plus it's a little easier to do this with our setup I think)
        await API.profInvites
          .accept(piid, {
            code: profInviteCode,
          })
          .then((url) => {
            router.replace(url)
          })
          .catch((err) => {
            // note that "error" redirect URLS will still be a 200 success. The only errors here would be more niche ones (like the browser failing to fetch)
            setErrorMessage(getErrorMessage(err))
          })
      })
      .catch(async () => {
        console.log(
          'User not logged in, setting cookies and redirecting to /login',
        )
        // If not logged in, set cookies and redirect to /login
        await API.profInvites
          .getDetails(piid)
          .then(async (details) => {
            await setProfInviteCookie(
              piid,
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
