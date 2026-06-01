import { Avatar, Button, Card } from 'antd'
import { ReactElement } from 'react'
import Meta from 'antd/es/card/Meta'
import { GithubOutlined, MailOutlined } from '@ant-design/icons'
import AboutPageModals from './AboutPageModals'
import Link from 'next/link'

/* Placing this inside the global app components since it's used in multiple spots (on landing page and inside login) */
const AboutPage: React.FC = (): ReactElement => {
  return (
    <>
      <title>HelpMe | About</title>
      <div className="flex flex-col gap-y-2 px-1 pb-20">
        <h1 className="text-center">About HelpMe</h1>

        <AboutPageModals />

        <h2>Overview + Mission</h2>
        <p>
          HelpMe is an open-source research project created with the goal of
          making it easier for professors to manage their courses and students
          to get course help.
        </p>
        <p>
          It is used in dozens of courses each semester with a userbase of
          thousands of students.
        </p>
        <p>
          For a list of features and showcase videos, please see the{' '}
          <Link href={'/'}>Home Page</Link>.
        </p>
        <h2 className="mt-3">Privacy + Data Safety</h2>
        <p>
          HelpMe is deeply committed to protecting student data. All data is
          stored on UBCO servers and is not shared or sold to any third-party
          services, including our AI Course Chatbot which uses local UBCO
          hardware. We also deeply value student anonymity, where students&apos;
          identities are hidden from other students and course staff unless
          absolutely necessary. We also aim to be as transparent as possible in
          what data we collect, what we use it for, and how we collect it, which
          you can find more information about in the Privacy Policy at the top
          of the page.
        </p>
        <p>
          We have also passed the Privacy Impact Assessment (PIA) at both UBC
          and UBCO. TODO: include links to copy of it?
        </p>

        <h2 className="mt-3">Who funds HelpMe?</h2>
        <p>
          HelpMe has no profit incentive and is primarily funded through a mix
          of grants and as part of research budgets.
        </p>

        <h2 className="mt-3">Github Link</h2>
        <p>
          HelpMe&apos;s code is open-source under a GPL-3.0 license, which you
          can find on the{' '}
          <a
            href="https://github.com/ubco-db/helpme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Github repository
          </a>
          . Though the Chatbot-specific code is currently on a private
          repository and only given on request.
        </p>

        <h2 className="mt-3">Meet the Current Team</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
          <Card
            title="Supervisor"
            variant="borderless"
            className="col-span-2 flex flex-col"
            classNames={{
              body: 'grow',
            }}
            actions={[
              <a key="email" href="mailto:ramon.lawrence@ubc.ca">
                <MailOutlined /> ramon.lawrence@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={
                <Avatar src="https://cmps-people.ok.ubc.ca/rlawrenc/images/lawrenceSmall.jpg" />
              }
              title="Dr. Ramon Lawrence"
              description={
                <p className="max-w-96">
                  Supervises and directs project development.
                </p>
              }
            />
          </Card>
          <Card
            title="Developer and Project Lead"
            variant="borderless"
            className="col-span-2 flex flex-col"
            classNames={{
              body: 'grow',
            }}
            actions={[
              <a key="email" href="mailto:adam.fipke@ubc.ca">
                <MailOutlined /> adam.fipke@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={
                <Avatar src="https://lh3.googleusercontent.com/a/ACg8ocLTTTeNhPRbmCDar9HN84SISsR4Zev4u9UHkoksmmNMCvroDw3Y=s288-c-no" />
              }
              title="Adam Fipke"
              description={
                <p>
                  Initially worked on the project as part of{' '}
                  <a
                    href="https://open.library.ubc.ca/soa/cIRcle/collections/undergraduateresearch/52966/items/1.0443556"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    his Honours Thesis
                  </a>{' '}
                  to improve the User Experience and Accessibility of the
                  system. Now hired for 8-20 hours/week as developer and project
                  lead. Responsible for dozens of features and the maintenance
                  of the vast majority of the system.
                </p>
              }
            />
          </Card>
          <Card
            title="Developer and Project Lead"
            variant="borderless"
            className="col-span-2 flex flex-col"
            classNames={{
              body: 'grow',
            }}
            actions={[
              <a key="email" href="mailto:bridgette.hunt@ubc.ca">
                <MailOutlined /> bridgette.hunt@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={
                <Avatar src="https://avatars.githubusercontent.com/u/112979899?v=4" />
              }
              title="Bridgette Hunt"
              description={
                <p>
                  Also initially worked on the project as part of{' '}
                  <a
                    href="https://open.library.ubc.ca/soa/cIRcle/collections/undergraduateresearch/52966/items/1.0448870"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    her Honours Thesis
                  </a>{' '}
                  investigating student sentiment towards HelpMe&apos;s Chatbot
                  compared to chatbots outside of HelpMe. Now working on it as
                  part of her masters program. Responsible for many features,
                  including Chatbot improvements, the Canvas integration, and
                  the Insights feature.
                </p>
              }
            />
          </Card>
          <Card
            title="Other Contributors"
            variant="borderless"
            className="col-span-2 flex flex-col xl:col-span-4 xl:col-start-2"
            classNames={{
              body: 'grow',
            }}
            actions={[
              <p key="repo-github">
                <a
                  href="https://github.com/ubco-db/helpme"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GithubOutlined /> Full list of contributors on the Github
                </a>{' '}
              </p>,
              <p key="old-repo-github">
                <a
                  href="https://github.com/ubco-db/office-hours"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GithubOutlined /> More can be found on the old repo
                </a>
              </p>,
            ]}
          >
            <Meta
              avatar={
                <div className="flex">
                  <Avatar
                    className="-ml-5"
                    src="https://avatars.githubusercontent.com/u/77289918?v=4"
                  />
                  <Avatar
                    className="-ml-5"
                    src="https://avatars.githubusercontent.com/u/71345367?v=4"
                  />
                  <Avatar
                    className="-ml-5"
                    src="https://avatars.githubusercontent.com/u/66136750?v=4"
                  />
                </div>
              }
              title="Other UBC + UBCO Students"
              description={
                <>
                  <p>
                    Over the years dozens of students have worked on the HelpMe
                    system to contribute bug fixes and features. They come to
                    work on HelpMe as part of their Honours Thesis or Directed
                    Studies for course credits, gaining experience working on a
                    modern tech stack in an actively-used system.
                  </p>
                  <p>
                    Additionally, HelpMe initially was forked from Khourly
                    College&apos;s{' '}
                    <a
                      href="https://github.com/sandboxnu/office-hours"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Office Hours system
                    </a>
                    , so shout out to the students that worked on the original
                    system too!
                  </p>
                </>
              }
            />
          </Card>
        </div>
      </div>
    </>
  )
}

export default AboutPage
