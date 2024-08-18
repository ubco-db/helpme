import { isProd } from '@koh/common'
import { redirect } from 'next/navigation'
import StandardPageContainer from '../components/StandardPageContainer'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isProd()) {
    redirect(`/courses`)
  }

  return (
    <main>
      <StandardPageContainer>{children}</StandardPageContainer>
    </main>
  )
}
