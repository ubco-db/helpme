'use client'

import * as Sentry from '@sentry/nextjs'
import { Button, Result } from 'antd'
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <Result
          status="500"
          title="500"
          subTitle={
            'Sorry, something went wrong:' +
            error +
            '.\n This error has been logged and we are working on fixing it.'
          }
          extra={
            <Button type="primary">
              <Link href="/api/v1/logout" prefetch={false}>
                Back To Login
              </Link>
            </Button>
          }
        />
      </body>
    </html>
  )
}
