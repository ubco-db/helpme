import { Metadata } from 'next'
import { ReactElement } from 'react'
import AboutPage from '../components/AboutPage'
import HeaderBar from '../components/HeaderBar'
import StandardPageContainer from '../components/standardPageContainer'

export const metadata: Metadata = {
  title: 'HelpMe | About',
}

export default function About(): ReactElement {
  return (
    <>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer className="!pl-0">
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <main>
        <StandardPageContainer className="gap-y-2">
          <AboutPage />
        </StandardPageContainer>
      </main>
    </>
  )
}
