'use client'

import * as Sentry from '@sentry/nextjs'
import { Button, Result } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ErrorPage429({
  error,
}: {
  error: Error & { digest?: string }
}) {
  const router = useRouter()
  useEffect(() => {
    Sentry.captureException(error)
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <Result
          status="500"
          title="429 - Too Many Requests"
          subTitle={
            'This error occurred because your browser was making too many errors to our servers.\n This error is likely on our end and we are working on fixing it.'
          }
          extra={
            <Button type="primary" onClick={() => router.back()}>
              Back
            </Button>
          }
        />
      </body>
    </html>
  )
}
