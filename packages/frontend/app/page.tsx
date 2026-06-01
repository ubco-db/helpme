import { Button, Divider } from 'antd'
import { Metadata } from 'next'
import Image from 'next/image'
import { ReactElement } from 'react'
import ubcLogo from '../public/ubc_logo.png'
import Link from 'next/link'
import StandardPageContainer from './components/standardPageContainer'
import HeaderBar from './components/HeaderBar'
import { LogIn } from 'lucide-react'

export const metadata: Metadata = {
  title: 'HelpMe',
}

export default function Home(): ReactElement {
  return (
    <>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer className="!pl-0">
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <main>
        <div className="ml-auto mr-auto max-w-2xl pt-4 text-center md:pt-4">
          <div className="flex flex-row items-center justify-center">
            {/* <Image src={ubcLogo} alt="UBC logo" className="mr-4" width={32} height={32} /> */}
            <h1>
              Welcome to <span className="font-bold">HelpMe</span>
            </h1>
          </div>

          <p className="text-1xl m-3 mb-5 mt-2 ">A Course Help System</p>
          <h2>Main Features</h2>
          <ul className="list-disc pl-4 text-left">
            <li className="m-3">
              <p>
                <b>Course Chatbot</b> - Allows students to get course-relevant
                AI assistance
              </p>
              <ul className="list-[square] pl-8 text-left md:pl-8">
                <li className="m-1">
                  Accessed by students via Invite Link or embeddable within
                  Canvas
                </li>
                <li className="m-1">Prompt is professor-customizable</li>
                <li className="m-1">
                  Hosted entirely on UBCO infrastructure - Safe for student data
                </li>
                <li className="m-1">
                  Supports drag-n-drop and automatic Canvas course document
                  upload
                </li>
              </ul>
            </li>
            <li className="m-3">
              <p>
                <b>Queueing system</b> for managing Online/In-Person/Hybrid
                office hours or labs{' '}
              </p>
            </li>
            <li className="m-3">
              <b>Anytime Questions</b> - A discussion board/email replacement
              where students first get a chatbot answer and can then decide if
              they are satisfied or still need more help
            </li>
            <li className="m-3">
              Primarily developed by students at UBC + UBCO
            </li>
            <li className="m-3">
              For more information, contact Ramon Lawrence,{' '}
              <a href="mailto:ramon.lawrence@ubc.ca">ramon.lawrence@ubc.ca</a>{' '}
              or see our <Link href={'/about'}>About Page</Link>
            </li>
          </ul>

          <Button
            type="primary"
            className="mt-4"
            href="/login"
            size="large"
            icon={<LogIn strokeWidth={1.5} className="mt-1" />}
          >
            Login
          </Button>

          <Divider className="my-8" />

          <div className="flex flex-col items-center justify-center">
            <p className="mb-1 text-base font-bold">HelpMe Overview</p>
            <div className="flex h-full w-full items-center justify-center">
              <div className="youtube-video-container">
                <iframe
                  src="https://www.youtube.com/embed/H9ywkvDdeZ0?si=kmMPT9d1eBacKb6Y"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
            <p className="mb-1 mt-6 text-base">Tutorial Videos</p>
            <p className="mb-2 text-sm text-gray-600">
              (Just one right now, more coming soon)
            </p>
            <div className="flex h-full w-full items-center justify-center">
              <div className="youtube-video-container">
                <iframe
                  src="https://www.youtube.com/embed/Y8v8HfEpkqo?si=ZgDnpjBhiIp1RRCT"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
