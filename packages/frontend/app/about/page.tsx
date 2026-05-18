import { Metadata } from 'next'
import { ReactElement } from 'react'
import AboutPage from '../components/AboutPage'

export const metadata: Metadata = {
  title: 'HelpMe',
}

export default function Home(): ReactElement {
  return (
    <main>
      <AboutPage />
    </main>
  )
}
