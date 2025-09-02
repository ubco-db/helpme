'use client'

import { useLtiCourse } from '@/app/contexts/LtiCourseContext'
import React from 'react'
import { Button } from 'antd'

export default function LtiIntegrationTokenPage(): React.ReactElement {
  const { courseId } = useLtiCourse()

  return (
    <div
      className={
        'mt-20 flex flex-col items-center justify-center gap-8 text-xl'
      }
    >
      <p>A new window was opened with the token generation request!</p>
      <p>
        Please navigate to this window and finish the login to authorize HelpMe.
      </p>
      <p>
        If you're finished generating the token, you can reload this page by
        clicking the button below.
      </p>
      <Button href={`/lti/${courseId}/integration`} className={'mt-16 text-lg'}>
        Return to Integration Management Page
      </Button>
    </div>
  )
}
