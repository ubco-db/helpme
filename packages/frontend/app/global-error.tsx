'use client'

import * as Sentry from '@sentry/nextjs'
import { Button, Result } from 'antd'
import { useEffect } from 'react'
import { Undo2 } from 'lucide-react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset?: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error(error)
  }, [error])

  const handleBack = () => {
    if (typeof window === 'undefined') return

    if (
      document.referrer &&
      document.referrer.startsWith(window.location.origin) &&
      document.referrer !== window.location.href
    ) {
      window.location.href = document.referrer
    } else if (window.history.length > 1) {
      window.history.back()
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } else {
      window.location.href = '/courses'
    }
  }

  // tailwind doesn't seem to work on this page
  return (
    <html>
      <body>
        <Result
          status="500"
          title="500"
          subTitle={
            'Sorry, something went wrong: ' +
            (error?.message || String(error)) +
            '.\n This error has been logged and we are working on fixing it.'
          }
          extra={
            <div
              style={{
                display: 'flex',
                justifyItems: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                width: 'fit-content',
                flexWrap: 'wrap',
                margin: '0 auto',
              }}
            >
              <a
                href=""
                onClick={() => {
                  handleBack()
                }}
              >
                <Button
                  type="primary"
                  icon={
                    <Undo2 strokeWidth={1.25} style={{ marginTop: '3px' }} />
                  }
                >
                  Back
                </Button>
              </a>
              <a href="/courses">
                <Button type="primary">My Courses</Button>
              </a>
            </div>
          }
        />
      </body>
    </html>
  )
}
