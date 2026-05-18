import { Button, Card } from 'antd'
import { ReactElement, useState } from 'react'
import ChangeLogModal from './ChangeLogModal'
import PrivacyPolicyModal from './PrivacyPolicyModal'
import UserAvatar from './UserAvatar'
import Meta from 'antd/es/card/Meta'

interface AboutPageProps {
  tip?: string
}

/* Placing this inside the global app components since it's used in multiple spots (on landing page and inside login) */
const AboutPage: React.FC<AboutPageProps> = ({ tip }): ReactElement => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false)
  return (
    <>
      <title>HelpMe | About</title>
      <div className="mx-auto flex w-full flex-col gap-y-2 px-1 sm:px-5 md:gap-y-3 md:px-8 xl:max-w-[1500px]">
        <h1>About HelpMe</h1>
        <p className="flex items-center justify-center">
          <Button type="primary" onClick={() => setIsChangelogOpen(true)}>
            View Changelog
          </Button>
          <Button type="primary" onClick={() => setIsPrivacyPolicyOpen(true)}>
            Privacy Policy
          </Button>
        </p>
        <ChangeLogModal
          isOpen={isChangelogOpen}
          setIsOpen={setIsChangelogOpen}
        />
        <PrivacyPolicyModal
          isOpen={isPrivacyPolicyOpen}
          setIsOpen={setIsPrivacyPolicyOpen}
        />
        <h2>Overview</h2>
        <p>
          HelpMe is an open-source research project created with the goal of
          making it easier for professors to manage their courses. It is used in
          dozens of courses each semester with a userbase of thousands of
          students.
        </p>
        <p>HelpMe&apos;s main features include: </p>
        <ul className="flex list-disc flex-col gap-y-2 pl-4 text-left md:pl-0">
          <li>
            A professor-customizable <b>Course Chatbot</b> for their students to
            use. Features Canvas integrations for automatic course document
            upload and an embedded Chatbot inside Canvas
          </li>
          <li>
            A <b>Queueing system</b> for making managing busy office hours or
            labs easier. Most useful for Hybrid or Online sessions, but also
            works for In-Person contexts
          </li>
          <li>
            <b>Anytime Questions</b> - A discussion board/email replacement
            where students first get a course chatbot answer and can then decide
            if they are satisfied or still need more help
          </li>
        </ul>
        <h2>Who funds HelpMe?</h2>
        <p>
          HelpMe has no profit incentive and is primarily funded through a mix
          of grants and as part of research budgets.
        </p>
        <p>
          Its code is open-source under a GPL-3.0 license, which you can find on
          the{' '}
          <a
            href="https://github.com/ubco-db/helpme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Github
          </a>
          .
        </p>
        <h2>Meet the current team</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Card
            title="Supervisor"
            variant="borderless"
            actions={[
              <a key="email" href="mailto:ramon.lawrence@ubc.ca">
                ramon.lawrence@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={<UserAvatar username="Ramon Lawrence" />}
              title="Dr. Ramon Lawrence"
              description={<p>Supervises and directs project development.</p>}
            />
          </Card>
          <Card
            title="Developer and Project Lead"
            variant="borderless"
            actions={[
              <a key="email" href="mailto:adam.fipke@ubc.ca">
                adam.fipke@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={<UserAvatar username="Adam Fipke" />}
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
            actions={[
              <a key="email" href="mailto:bridgette.hunt@ubc.ca">
                bridgette.hunt@ubc.ca
              </a>,
            ]}
          >
            <Meta
              avatar={<UserAvatar username="Bridgette Hunt" />}
              title="Bridgette Hunt"
              description={
                <p>
                  Initially worked on the project as part of{' '}
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
            actions={[
              <p key="contributing">
                You can find a full list of contributors on the{' '}
                <a
                  href="https://github.com/ubco-db/helpme"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Github
                </a>{' '}
                (more can be found on the{' '}
                <a
                  href="https://github.com/ubco-db/office-hours"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  old repo
                </a>
                ).
              </p>,
            ]}
          >
            <Meta
              avatar={
                <div className="flex gap-x-[-1rem]">
                  <UserAvatar />
                  <UserAvatar />
                  <UserAvatar />
                </div>
              }
              title="Other Students"
              description={
                <p>
                  Over the years, dozens of students, primarily from UBC and
                  UBCO, have worked on the HelpMe system, contributing bug fixes
                  and features. They come to work on HelpMe as part of their
                  Honours Thesis or Directed Studies for course credits, gaining
                  experience working on a modern tech stack in an actively-used
                  system.
                </p>
              }
            />
          </Card>
        </div>
      </div>
    </>
  )
}

export default AboutPage
