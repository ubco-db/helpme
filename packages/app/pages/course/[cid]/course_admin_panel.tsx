import { Role } from '@koh/common'
import DefaultErrorPage from 'next/error'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { ReactElement } from 'react'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import NavBar from '../../../components/Nav/NavBar'
import CourseAdminPanel, {
  CourseAdminOptions,
} from '../../../components/Settings/CourseAdminPanel'
import { useRoleInCourse } from '../../../hooks/useRoleInCourse'
import { useProfile } from '../../../hooks/useProfile'

export default function CourseAdminPanelPage(): ReactElement {
  const router = useRouter()
  const courseId = router.query['cid']
  const profile = useProfile()
  const role = useRoleInCourse(Number(courseId))
  const defaultPage = router.query['defaultPage'] as CourseAdminOptions

  if (role !== Role.PROFESSOR && role !== Role.TA) {
    return <DefaultErrorPage statusCode={404} />
  }

  return (
    <div>
      <StandardPageContainer>
        <Head>
          <title>
            Course Admin Panel | {profile?.organization?.organizationName}{' '}
            HelpMe
          </title>
        </Head>
        <NavBar courseId={Number(courseId)} />
        {courseId && (
          <CourseAdminPanel
            courseId={Number(courseId)}
            defaultPage={defaultPage}
          />
        )}
      </StandardPageContainer>
    </div>
  )
}
