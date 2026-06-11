import { Button, Divider } from 'antd'
import { Metadata } from 'next'
import Image from 'next/image'
import { ReactElement } from 'react'
import ubcLogo from '../public/ubc_logo.png'
import { LoginOutlined } from '@ant-design/icons'

export const metadata: Metadata = {
  title: 'HelpMe',
}

export default function Home(): ReactElement {
  return (
    <main>
      <div className="ml-auto mr-auto max-w-2xl pt-4 text-center md:pt-10">
        <div className="flex flex-col items-center justify-center">
          <Image src={ubcLogo} alt="UBC logo" className="mb-4 mr-4 w-12" />
          <h1>
            Welcome to <span className="font-bold">HelpMe</span>
          </h1>
        </div>

        <p className="text-1xl m-3 my-5 ">Course Help System</p>
        <ul className="list-disc pl-4 text-left md:pl-0">
          <li className="m-2">
            <b>Course Chatbot</b> for real-time answers about course content
            (Professor-customizable)
          </li>
          <li className="m-2">
            <b>Queueing system</b> for Online/In-Person/Hybrid office hours or
            labs
          </li>
          <li className="m-2">
            <b>Anytime Questions</b> - An &quot;Email 2.0&quot; where students
            first get a chatbot answer and can then decide if they are satisfied
            or still need more help
          </li>
          <li className="m-2">
            Primarily developed by students at UBC to help make course
            management easier
          </li>
          <li className="m-2">
            For more information, contact Ramon Lawrence,{' '}
            <a href="mailto:ramon.lawrence@ubc.ca" className="text-blue-500">
              ramon.lawrence@ubc.ca
            </a>
          </li>
        </ul>

        <Button
          type="primary"
          className="mt-4"
          href="/login"
          size="large"
          icon={<LoginOutlined />}
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
  )
}
