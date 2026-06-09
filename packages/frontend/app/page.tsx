import { Button } from 'antd'
import { Metadata } from 'next'
import { ReactElement, ReactNode } from 'react'
import ImageProfViewChatbot from '@/public/actually_public/images/helpme_prof_view_chatbot_questions.png'
import ImageChatbotCourseHomePage from '@/public/actually_public/images/helpme_chatbot_course_homepage.png'
import ImageCanvasIntegrationAutoSync from '@/public/actually_public/images/helpme_canvas_integration_auto_sync.png'
import ImageChatbotDocumentUpload from '@/public/actually_public/images/helpme_chatbot_document_drag_n_drop_upload.png'
import ImageProfInsertQuestionAsNewChunk from '@/public/actually_public/images/helpme_prof_insert_question_as_new_chunk.png'
import ImageChatbotEditPrompt from '@/public/actually_public/images/helpme_chatbot_edit_prompt.png'
import ImageProfQueueHelpStudent from '@/public/actually_public/images/helpme_prof_queue_help_student.png'
import ImageStudentQueueCreateQuestion from '@/public/actually_public/images/helpme_student_queue_create_question.png'
import ImageStudentGettingHelp from '@/public/actually_public/images/helpme_student_getting_help.png'
import ImageProfQueueOverview from '@/public/actually_public/images/helpme_prof_queue_overview.png'
import ImageQueuesJoinViaQRcode from '@/public/actually_public/images/helpme_queues_join_via_QR_code.png'
import ImageQueueSchedule from '@/public/actually_public/images/helpme_queue_schedule.png'
import ImageAnytimeQuestionsCreateQuestion from '@/public/actually_public/images/helpme_anytime_questions_create_question.png'
import ImageAnytimeQuestionsProfEditResponse from '@/public/actually_public/images/helpme_anytime_questions_prof_edit_response.png'
import ImageAnytimeQuestionsProfView from '@/public/actually_public/images/helpme_anytime_questions_prof_view.png'
import ImageAnytimeQuestionsQuestionCreated from '@/public/actually_public/images/helpme_anytime_questions_question_created.png'
import ImageAnytimeQuestionsStudentWithCommentsOpen from '@/public/actually_public/images/helpme_anytime_questions_student_with_comments_open.png'
import ImageInsightsUsageOverTime from '@/public/actually_public/images/helpme_insights_usage_over_time.png'
import ImageInsightsQuestionTypesOverTime from '@/public/actually_public/images/helpme_insights_question_types_over_time.png'
import ImageInsightsMostActiveTimes from '@/public/actually_public/images/helpme_insights_most_active_times.png'

import StandardPageContainer from './components/standardPageContainer'
import HeaderBar from './components/HeaderBar'
import {
  Bot,
  LogIn,
  Search,
  UsersRound,
  MessageCircleQuestion,
  LineChart,
} from 'lucide-react'
import ImageCarousel from './components/ImageCarousel'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'HelpMe',
}

/** Small hint rendered beneath each ImageCarousel */
const EnlargeHint: React.FC = (): ReactElement => {
  return (
    <p className="flex select-none items-center justify-center gap-1.5 pt-2.5 text-xs text-[#999]">
      <Search className="h-[13px] w-[13px] opacity-70" />
      <span>
        <span className="hidden md:inline">Click</span>
        <span className="md:hidden">Tap</span> to enlarge + more details
      </span>
    </p>
  )
}

/* HighLight*/
const HL: React.FC<{ children: ReactNode }> = ({ children }): ReactElement => {
  return <b className="font-medium text-[#396589]">{children}</b>
}

export default function Home(): ReactElement {
  return (
    <>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer className="!pl-0">
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <main className="pb-6 md:pb-8">
        {/* ─── Hero ─── */}
        <section className="pb-6 pt-10 text-center md:pb-8 md:pt-14">
          <h1 className="text-4xl tracking-tight md:text-5xl">
            Welcome to{' '}
            <span className="text-helpmeblue font-extrabold">HelpMe</span>
          </h1>
          <p className="mt-1 text-lg text-[#555]">A Course Help System</p>
          <Link href="/login">
            <Button
              type="primary"
              className="mb-2 mt-6 h-12 rounded-lg px-8"
              size="large"
              icon={<LogIn strokeWidth={1.5} className="mt-1" />}
            >
              Login
            </Button>
          </Link>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-6 md:px-8">
          <h2 className="mb-3 text-center text-3xl">Overview</h2>
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
        </section>

        {/* ─── Features ─── */}
        <section className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-6 md:px-8 md:pb-8">
          <h2 className="mb-3 text-center text-3xl">Main Features</h2>

          <div className="flex w-full flex-col gap-4 md:gap-6">
            {/* ── Chatbot ── */}
            <div className="border-l-helpmeblue rounded-lg border-l-[3px] bg-white px-4 py-5 shadow ring-1 ring-black/[0.03] md:rounded-2xl md:border-l-4 md:px-10 md:py-8">
              <div className="flex w-full flex-col items-center gap-5 md:flex-row">
                <div className="flex w-full flex-col items-center justify-center md:w-2/5">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-600">
                      <Bot size={28} strokeWidth={1.75} />
                    </div>
                    <h3
                      id="course-chatbot"
                      className=" text-2xl font-bold text-[#1a1a1a]"
                    >
                      Course Chatbot
                    </h3>
                  </div>
                  <p className="text-base text-[#444]">
                    <HL>
                      Allows students to get course-relevant AI assistance.
                    </HL>
                  </p>
                  <ul className="mt-3.5 space-y-2.5 pl-5 text-left text-sm text-[#444]">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Accessed by students via <HL>Invite Link</HL> or{' '}
                        <HL>embeddable within Canvas</HL>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Hosted entirely on UBCO infrastructure -{' '}
                        <HL>Safe for student data.</HL>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Students can convert to{' '}
                        <a href="#anytime-questions">Anytime Question</a> for{' '}
                        <HL>Human In The Loop (HITL)</HL> support.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>Prompt is professor-customizable.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>
                        Supports drag-n-drop and automatic Canvas course
                        document upload.
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="w-full min-w-0 md:w-3/5">
                  <ImageCarousel
                    images={[
                      {
                        src: ImageChatbotCourseHomePage,
                        alt: "Course home page with a Chatbot window open where the user is asking 'When is the midterm?' and the chatbot replying with 'The midterm exam is scheduled for Thursday, October 17, 2025, during the lab session' with a source saying Syllabus page 2",
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Homepage with Chatbot{' '}
                            </h4>
                            <p className="text-sm">
                              Here the student asks a question to the Course
                              Chatbot where it returns a course-relevant
                              response with a citation to the uploaded Syllabus.
                              They also have the option to convert the question
                              to an Anytime Question if they want further help
                              from course staff or discuss with other students.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageChatbotDocumentUpload,
                        alt: 'A popup form asking the professor what documents they would like to upload to the Course Chatbot. The professor is dragging a lab manual file from their file system into the interface. There are several slide decks and other course documents that have been selected for upload.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Document Upload
                            </h4>
                            <p className="text-sm">
                              A simple drag-n-drop! Supports bulk-upload and
                              many file types (.pdf, .docx, .pptx, .xlsx, .csv,
                              .txt, .md, and most image formats).
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageCanvasIntegrationAutoSync,
                        alt: "A dashboard outlining the details of this HelpMe Course's Canvas integration. Includes buttons for customizing what Canvas items are synchronized with HelpMe's Chatbot",
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Canvas Integration - Auto Upload
                            </h4>
                            <p className="text-sm">
                              HelpMe integrates with Canvas, allowing Canvas
                              items to be automatically synchronized into your
                              HelpMe Course Chatbot&apos;s Knowledge Base. Items
                              include: Announcements, Assignments, Files, Pages,
                              and Quizzes, with options to customize what items
                              are synchronized. Also lets you compare what
                              students are in your HelpMe course but not in your
                              Canvas course, or vise-versa.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageChatbotEditPrompt,
                        alt: 'A popup form allowing the professor to customize the AI model and prompt, amongst some other more advanced settings like temperature and document similarity threshold.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Professor-Customizable Prompt
                            </h4>
                            <p className="text-sm">
                              Professors have access to the prompt and can
                              include course-specific instructions, such as what
                              the course is, what the goals of the course are
                              (at a high level), how you want the chatbot to
                              respond, and why it&apos;s important for the
                              chatbot to respond that way to meet the
                              course&apos;s goals. They can also choose
                              different models for more advanced configuration.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageProfViewChatbot,
                        alt: 'A table interface with a list of Chatbot questions. Fields include: Question, Answer, Document CItations, Verified, Suggested, Times Asked, User Score, Last Asked. Notably the question creator field is missing (as it is anonymized and professors can only access the question creator as a part of studies with explicit student consent or when a student breaches the Terms of Service). There is also a button to edit each chatbot question.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              See what your students are asking!
                            </h4>
                            <p className="text-sm">
                              Chatbot questions are collected, stored on UBC
                              hardware, and anonymized. Unlike other major AI
                              platforms, this will allow you to see where your
                              students are struggling <i>and</i> is student-data
                              safe!
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageProfInsertQuestionAsNewChunk,
                        alt: 'A popup form with the question field as "When is the midterm?" and an answer field with "The midterm exam is schedule for Thursday, October 17th, 2025, during the lab session" with a citation from the Syllabus, with options to remove or add citations. There are 3 checkboxes: Mark Q&A as Verified by Human, Mark Q&A as Suggested, and Insert Q&A into Chatbot Knowledge Base. The tooltip for the latter is hovered, where it explains how inserting it will treat this question and answer as a source that the AI can then reference and cite in future questions.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Expand your Chatbot&apos;s Knowledge Base
                            </h4>
                            <p className="text-sm">
                              Found a place where the Chatbot responded poorly
                              due to a gap in its Knowledge Base? Edit its
                              response and then insert the Question and Answer
                              back into the Knowledge Base!
                            </p>
                          </div>
                        ),
                      },
                    ]}
                  />
                  <EnlargeHint />
                </div>
              </div>
            </div>

            {/* ── Queuing ── */}
            <div className="border-l-helpmeblue rounded-lg border-l-[3px] bg-white px-4 py-5 shadow ring-1 ring-black/[0.03] md:rounded-2xl md:border-l-4 md:px-10 md:py-8">
              <div className="flex w-full flex-col-reverse items-center gap-5 md:flex-row">
                <div className="w-full min-w-0 md:w-3/5">
                  <ImageCarousel
                    images={[
                      {
                        src: ImageProfQueueOverview,
                        alt: 'Queue interface (course-staff-view) with two questions in the queue. Each question has 4 buttons: delete, ask to rephrase, message student, and start helping. Each question also has a location (Online or In-Person), who is asking what, how long they were waiting for, and student-added question tags. Other buttons in the interface include: Check Out, Edit Queue Details, Add student to Queue, and an Away toggle. There are also professor-customized queue notes that say where the office is and a little module saying the queue is hybrid. There is also a list of staff in the queue, with the professor being listed as Available as they are not helping anyone yet.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Staff Queue Interface
                            </h4>
                            <p className="text-sm">
                              Course Staff have many tools for managing
                              questions in the queue, including: delete, ask to
                              rephrase, message student, and start helping.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageStudentQueueCreateQuestion,
                        alt: 'A popup form for creating a question with the following fields: question categories (tags), question text, and whether the question is Online or In-Person. It also states that "You are currently 2nd in queue, your spot in queue has been temporarily reserved. Please describe your question to finish joining the queue."',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Student Creating Question
                            </h4>
                            <p className="text-sm">
                              In addition to the question text field, students
                              can add professor-defined tags (useful for
                              Insights) and whether they are asking the question
                              In-Person or Online (for Hybrid queues).
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageProfQueueHelpStudent,
                        alt: 'Course Staff view of queue interface except this time the professor is helping one of the students questions. There are 4 buttons: requeue, cant find, done helping, and pause question. There is also a timer for how long the question has been helped for.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Staff Helping Student
                            </h4>
                            <p className="text-sm">
                              Once helping a question, course staff have the
                              following options: requeue, can&apos;t find, done
                              helping, and pause.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageStudentGettingHelp,
                        alt: 'Student view of being helped. There is a popup saying that the professor is ready for them now, and also states any professor-set queue notes. There are two buttons: "Join Meeting Now" (since the student is attending Online) and "Not Ready?"',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Student Being Helped
                            </h4>
                            <p className="text-sm">
                              Once helped, the student gets a popup and
                              notification. In the case where the student is
                              getting help online, they will have the option to
                              join the online meeting. Any professor-set queue
                              notes are also listed here in case the professor
                              has additional instructions for the student.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageQueuesJoinViaQRcode,
                        alt: 'A simple page with the name of the queue, the course, some text saying that there are currently 2 students in queue, a list of staff (just the professor is there right now, it says he\'s looking for his next student), and a QR code saying "Scan to join queue"',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Join Queue via QR Code
                            </h4>
                            <p className="text-sm">
                              For In-Person or Hybrid scenarios, students
                              joining in person can simply scan a QR code. This
                              QR code can be printed outside your office or
                              shown on the lab projector. They can also
                              instantly see how many students are in the queue
                              without needing to login - especially useful for
                              busy Hybrid queues since otherwise they
                              wouldn&apos;t know how busy it is or how long
                              they&apos;ll be waiting.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageQueueSchedule,
                        alt: "A schedule page for a course with a weekly calendar view with about 20 events on it. Each has an event name (in this case, Lab1, Lab2, Lab3, etc.), a time, a location, whether it's online/in-person/hybrid, and what staff are assigned to the event. ",
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Helps manage large courses!
                            </h4>
                            <p className="text-sm">
                              Supports big courses with lots of TAs and lab
                              sections. Allows for multiple queues and multiple
                              staff to be checked in to a queue. Also supports
                              creating &quot;events&quot; for each queue with
                              assigned staff for easier managing (such as
                              auto-checkout).
                            </p>
                          </div>
                        ),
                      },
                    ]}
                  />
                  <EnlargeHint />
                </div>
                <div className="flex w-full flex-col items-center justify-center md:w-2/5">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600">
                      <UsersRound size={28} strokeWidth={1.75} />
                    </div>
                    <h3
                      id="queueing-system"
                      className="text-2xl font-bold text-[#1a1a1a]"
                    >
                      Queueing System
                    </h3>
                  </div>
                  <p className="text-base text-[#444]">
                    <HL>For managing office hours or labs.</HL>
                  </p>
                  <ul className="mt-3.5 space-y-2.5 pl-5 text-left text-sm text-[#444]">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                      <span>
                        Especially useful for{' '}
                        <HL>busy Hybrid or Online sessions</HL>, but also
                        supports In-Person queues.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                      <span>
                        Scales well for <HL>large courses</HL>! Supports
                        multiple queues with multiple staff at the same time,
                        with a built-in schedule to help manage everything.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                      <span>
                        <HL>Tracks what questions were asked</HL> - Used in{' '}
                        <a href="#insights">Insights</a>!
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                      <span>
                        Don&apos;t have any busy office hours or labs?{' '}
                        <HL>
                          All HelpMe features can be toggled off at a click of a
                          button!
                        </HL>{' '}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ── Anytime Questions ── */}
            <div className="border-l-helpmeblue rounded-lg border-l-[3px] bg-white px-4 py-5 shadow ring-1 ring-black/[0.03] md:rounded-2xl md:border-l-4 md:px-10 md:py-8">
              <div className="flex w-full flex-col items-center gap-5 md:flex-row">
                <div className="flex w-full flex-col items-center justify-center md:w-2/5">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-600">
                      <MessageCircleQuestion size={28} strokeWidth={1.75} />
                    </div>
                    <h3
                      id="anytime-questions"
                      className="text-2xl font-bold text-[#1a1a1a]"
                    >
                      Anytime Questions
                    </h3>
                  </div>
                  <p className="text-base text-[#444]">
                    <HL>A discussion board/email replacement.</HL>
                  </p>
                  <ul className="mt-3.5 space-y-2.5 pl-5 text-left text-sm text-[#444]">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                      <span>
                        Students first get a chatbot answer. If they still need
                        help, they can click a button which notifies course
                        staff.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                      <span>
                        Any Course Staff member can help - great for large
                        courses!
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                      <span>
                        Students are fully anonymized to one another by default,
                        allowing for <HL>anxiety-free participation</HL>.
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="w-full min-w-0 md:w-3/5">
                  <ImageCarousel
                    images={[
                      {
                        src: ImageAnytimeQuestionsProfView,
                        alt: 'Course staff-view of the Anytime Question Hub. There are 3 questions, each posted by an anonymous animal (students appear anonymous to other students by default). One of the questions is public (visible to other students) and the other two are private and need attention (they were unhappy with their AI response). Some of these questions have comments but they are collapsed. There are filters to filter by what questions are verified/unverified and what questions are public/private. Staff also have a checkbox to unveil the authors of each question (for moderation purposes). Staff also have the option to delete questions or post an updated response.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Staff View of Anytime Questions
                            </h4>
                            <p className="text-sm">
                              Here is a list of all the Anytime Questions
                              students have asked. It shows which ones have been
                              human verified vs which ones got an AI answer but
                              still need help.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageAnytimeQuestionsCreateQuestion,
                        alt: 'Student view of a popup form to create a new Anytime Question with the following fields: Question Abstract, Question Text, and a checkbox on whether to Appear Anonymous. Here the student is asking a question for what IDE to use for Assignment 1',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Student Creating Anytime Question
                            </h4>
                            <p className="text-sm">
                              When creating an Anytime Question or Comment,
                              students are anonymized to other students by
                              default. Course staff can still who posted what
                              for moderation purposes. Professors can also
                              configure it so that students have the option to
                              post their questions publicly to other students
                              (by default, all questions are private unless made
                              public by course staff).
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageAnytimeQuestionsQuestionCreated,
                        alt: 'Student view of the newly created question. Here we see the AI answer was course-relevant and actually pretty helpful. Also, the question creator appears as "Anonymous Frog (You)". There are two buttons, one that says "Satisfied" and another that says "Still need faculty Help". There are also buttons to delete or edit the question, or to post a comment.',
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Student Question Created
                            </h4>
                            <p className="text-sm">
                              Once created, the student can view the AI answer.
                              They can then decide whether they are satisfied
                              with the response or still need faculty help.
                              Choosing the latter will send an email
                              notification to the course staff to provide an
                              answer.
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageAnytimeQuestionsProfEditResponse,
                        alt: "Course-staff view of a popup form to edit the response to the student's question with the following fields: Answer text (currently filled with the AI answer), a checkbox to Set question visible to all students, and a checkbox to mark as verified by faculty. Here the professor has modified the response slightly and checked the 'Mark as verified by faculty' box.",
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Course Staff Editing Response
                            </h4>
                            <p className="text-sm">
                              Course Staff can edit the AI&apos;s response and
                              mark it as verified. Once saved, the student will
                              be email notified. They also have the option to
                              make the question visible to other students (the
                              student will still be anonymized).
                            </p>
                          </div>
                        ),
                      },
                      {
                        src: ImageAnytimeQuestionsStudentWithCommentsOpen,
                        alt: "View of the Anytime Question Hub with one of the questions expanded to see all the comments for said question. The initial question was asking where to find this week's reading, with the TA leaving a comment that they were inspired by this and have created a new page with all of the readings. The professor thanks the TA in another comment, and explains that since they linked up their HelpMe course with Canvas, the new page with all the readings will get auto-synchronized into the Chatbot.",
                        caption: (
                          <div>
                            <h4 className="mb-1 text-base font-bold">
                              Comments!
                            </h4>
                            <p className="text-sm">
                              Anytime Questions also supports Comments, allowing
                              course staff (or students for public questions) to
                              continue the conversation.
                            </p>
                          </div>
                        ),
                      },
                    ]}
                  />
                  <EnlargeHint />
                </div>
              </div>
            </div>

            {/* ── Insights ── */}
            <div className="border-l-helpmeblue rounded-lg border-l-[3px] bg-white px-4 py-5 shadow ring-1 ring-black/[0.03] md:rounded-2xl md:border-l-4 md:px-10 md:py-8">
              <div className="flex w-full flex-col-reverse items-center gap-5 md:flex-row">
                <div className="w-full min-w-0 md:w-3/5">
                  <ImageCarousel
                    images={[
                      {
                        src: ImageInsightsUsageOverTime,
                        alt: 'A dashboard with a chart displaying the system usage over time. It shows how many Queue Questions, Anytime Questions, and Chatbot Interactions are there over time. There is also a second chart that is cutoff that displays the Staff Workload, which explains how many queue questions on average do course staff members help each day of the week.',
                        caption: ' ',
                      },
                      {
                        src: ImageInsightsQuestionTypesOverTime,
                        alt: "A dashboard with a chart displaying 'Question Types Over Time', which displays what categories (that professors define) of questions are being asked over time. There is also a pie chart that is cutoff that has the total number of questions asked and each slice of the pie is each question type.",
                        caption: ' ',
                      },
                      {
                        src: ImageInsightsMostActiveTimes,
                        alt: "A dashboard with a chart displaying 'Most Active Times', which displays 'The most in-demand queue times during the calendar week, based on the number of queued questions throughout the day'. There is also a chart that is cutoff that says Human vs. Chatbot Votes, saying how helpful are human anytime question answers versus chatbot answers.",
                        caption: ' ',
                      },
                    ]}
                  />
                  <EnlargeHint />
                </div>
                <div className="flex w-full flex-col items-center justify-center md:w-2/5">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-600">
                      <LineChart size={28} strokeWidth={1.75} />
                    </div>
                    <h3
                      id="insights"
                      className="text-2xl font-bold text-[#1a1a1a]"
                    >
                      Insights
                    </h3>
                  </div>
                  <p className="text-base text-[#444]">
                    See usage, busy times, what types of questions are being
                    asked, and much more!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Interested? CTA ─── */}
        <section className="mx-auto max-w-3xl px-4 py-6 md:px-8">
          <div className="landing-cta-gradient-border relative overflow-hidden rounded-2xl bg-white px-5 py-6 text-left shadow md:px-10 md:py-8 md:text-center">
            <h2 className="mb-2 text-center text-2xl">
              Interested in using HelpMe?
            </h2>
            <p className="mb-3 text-base text-[#444] md:mb-4">
              <HL>
                Contact Ramon Lawrence at{' '}
                <a href="mailto:ramon.lawrence@ubc.ca">ramon.lawrence@ubc.ca</a>{' '}
                and we can create you a HelpMe Course Shell that you can
                customize and invite your students to.
              </HL>
            </p>
            <p className="mb-3 text-base text-[#444] md:mb-4">
              HelpMe is funded through research grants and is primarily
              developed by students at UBC + UBCO.{' '}
              <HL>It&apos;s free to add to your UBC courses.</HL>
            </p>
            <p className="text-base text-[#444]">
              Visit our <Link href="/about">About</Link> page for more
              information.
            </p>
          </div>
        </section>

        {/* ─── Tutorial Videos ─── */}
        <section className="mx-auto flex max-w-2xl flex-col items-center justify-center">
          <h2 className="mb-1 mt-6 text-base">Additional Tutorial Videos</h2>
          <p className="mb-2 text-xs text-gray-600">
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
        </section>
      </main>
    </>
  )
}
