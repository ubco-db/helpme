import { Button } from 'antd'
import Head from 'next/head'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function Home(): ReactElement {
  return (
    <>
      <Head>
        <title>HelpMe</title>
      </Head>
      <div className="ml-auto mr-auto max-w-[600px] pt-10 text-center">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/ubc_logo.png"
            alt="UBC logo"
            width={64}
            height={64}
            className="mb-4 mr-4 w-12"
          />
          <h1>
            Welcome to <span className="font-bold">HelpMe</span>
          </h1>
        </div>

        <p className="text-1xl m-3 my-5 ">HelpMe Course System</p>
        <ul className="list-disc text-left">
          <li className="m-2">
            Supports in-person and virtual office hours with instructors and
            teaching assistants
          </li>
          <li className="m-2">
            Chatbot for real-time answers about course content and course
            questions
          </li>
          <li className="m-2">
            For more information, contact Ramon Lawrence,{' '}
            <a href="mailto:ramon.lawrence@ubc.ca" className="text-blue-500">
              ramon.lawrence@ubc.ca
            </a>
          </li>
        </ul>

        <Button type="primary" className="mt-4 rounded-lg" href="/login">
          Login &gt;
        </Button>
      </div>
    </>
  )
}
