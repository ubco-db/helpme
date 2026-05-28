import { Metadata } from 'next'
import { ReactElement } from 'react'
import AboutPage from '../components/AboutPage'
import Link from 'next/link'
import { ArrowLeftOutlined } from '@ant-design/icons'

export const metadata: Metadata = {
  title: 'HelpMe | About',
}

export default function About(): ReactElement {
  return (
    <main className="mx-auto flex w-full flex-col gap-y-2 px-1 sm:px-5 md:gap-y-3 md:px-8 xl:max-w-[1500px]">
      <Link className="mt-2" href="/">
        <ArrowLeftOutlined /> Back to Home Page
      </Link>
      <AboutPage />
    </main>
  )
}
