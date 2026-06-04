import { Button, Divider } from 'antd'
import { Metadata } from 'next'
import { ReactElement } from 'react'
import ImageProfViewChatbot from '@/public/actually_public/images/helpme_prof_view_chatbot_questions.png'
import ImageChatbotCourseHomePage from '@/public/actually_public/images/helpme_chatbot_course_homepage.png'
import ImageCanvasIntegrationAutoSync from '@/public/actually_public/images/helpme_canvas_integration_auto_sync.png'
import ImageChatbotDocumentUpload from '@/public/actually_public/images/helpme_chatbot_document_drag_n_drop_upload.png'
import ImageProfInsertQuestionAsNewChunk from '@/public/actually_public/images/helpme_prof_insert_question_as_new_chunk.png'
import ImageProfQueueHelpStudent from '@/public/actually_public/images/helpme_prof_queue_help_student.png'
import ImageStudentQueueCreateQuestion from '@/public/actually_public/images/helpme_student_queue_create_question.png'
import ImageStudentGettingHelp from '@/public/actually_public/images/helpme_student_getting_help.png'
import ImageProfQueueOverview from '@/public/actually_public/images/helpme_prof_queue_overview.png'
import ImageAnytimeQuestionsCreateQuestion from '@/public/actually_public/images/helpme_anytime_questions_create_question.png'
import ImageAnytimeQuestionsProfEditResponse from '@/public/actually_public/images/helpme_anytime_questions_prof_edit_response.png'
import ImageAnytimeQuestionsProfView from '@/public/actually_public/images/helpme_anytime_questions_prof_view.png'
import ImageAnytimeQuestionsQuestionCreated from '@/public/actually_public/images/helpme_anytime_questions_question_created.png'
import ImageAnytimeQuestionsStudentWithCommentsOpen from '@/public/actually_public/images/helpme_anytime_questions_student_with_comments_open.png'
import ImageInsightsUsageOverTime from '@/public/actually_public/images/helpme_insights_usage_over_time.png'

import StandardPageContainer from './components/standardPageContainer'
import HeaderBar from './components/HeaderBar'
import { LogIn } from 'lucide-react'
import ImageCarousel from './components/ImageCarousel'

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
        <div className="mx-auto pt-4 text-center md:pt-4">
          <div className="flex flex-row items-center justify-center">
            <h1>
              Welcome to <span className="font-bold">HelpMe</span>
            </h1>
          </div>

          <p className="text-1xl m-3 mt-2 ">A Course Help System</p>

          <Button
            type="primary"
            className="my-8 mb-10"
            href="/login"
            size="large"
            icon={<LogIn strokeWidth={1.5} className="mt-1" />}
          >
            Login
          </Button>

          <h2>Main Features</h2>
          <div className="bg-helpmeblue py-4">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex w-full flex-col items-center justify-center md:flex-1">
                <p className="md:w-1/2">
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
                    Hosted entirely on UBCO infrastructure - Safe for student
                    data
                  </li>
                  <li className="m-1">
                    Supports drag-n-drop and automatic Canvas course document
                    upload
                  </li>
                </ul>
              </div>
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
                          Here the student asks a question to the Course Chatbot
                          where it returns a course-relevant response with a
                          citation to the uploaded Syllabus.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageChatbotDocumentUpload,
                    alt: 'A popup asking the professor what documents they would like to upload to the Course Chatbot. The professor is dragging a lab manual file from their file system into the interface. There are several slide decks and other course documents that have been selected for upload.',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Course Document Upload
                        </h4>
                        <p className="text-sm">
                          A simple drag-n-drop! Supports bulk-upload and many
                          file types (.pdf, .docx, .pptx, .xlsx, .csv, .txt,
                          .md, and most image formats).
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
                          HelpMe integrates with Canvas, allowing Canvas items
                          to be automatically synchronized into your HelpMe
                          Course Chatbot&apos;s Knowledge Base. Items include:
                          Announcements, Assignments, Files, Pages, and Quizzes,
                          with options to customize what items are synchronized.
                          Also lets you compare what students are in your HelpMe
                          course but not in your Canvas course, or vise-versa.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageProfViewChatbot,
                    alt: 'Professor View TODO',
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
                    alt: 'Prof Insert Question As New Chunk',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Expand your Chatbot&apos;s Knowledge Base
                        </h4>
                        <p className="text-sm">
                          Found a place where the Chatbot responded poorly due
                          to a gap in its Knowledge Base? Edit its response and
                          then insert the Question and Answer back into the
                          Chatbot&apos; Knowledge Base!
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
          <div className="bg-white py-4">
            <div className="mx-auto flex w-full max-w-6xl flex-col-reverse items-center justify-between gap-4 md:flex-row">
              <ImageCarousel
                images={[
                  {
                    src: ImageProfQueueOverview,
                    alt: "Course home page with a Chatbot window open where the user is asking 'When is the midterm?' and the chatbot replying with 'The midterm exam is scheduled for Thursday, October 17, 2025, during the lab session' with a source saying Syllabus page 2",
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Course Chatbot
                        </h4>
                        <p className="text-sm">
                          Allows students to get course-relevant AI assistance
                          with precise source citations.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageStudentQueueCreateQuestion,
                    alt: 'Canvas Integration',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Canvas Auto-Sync
                        </h4>
                        <p className="text-sm">
                          Seamlessly syncs syllabus and course documents
                          directly from Canvas to feed the chatbot knowledge
                          base.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageProfQueueHelpStudent,
                    alt: 'Professor View',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Professor Analytics
                        </h4>
                        <p className="text-sm">
                          Enables professors to monitor chatbot activity, review
                          questions, and calibrate custom prompt context.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageStudentGettingHelp,
                    alt: 'Document Upload',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Document Drag & Drop
                        </h4>
                        <p className="text-sm">
                          Provides standard drag-and-drop file upload for
                          students and professors to add custom reference
                          materials.
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
              <p className="md:w-1/2">
                <b>Queueing system</b> for managing Online/In-Person/Hybrid
                office hours or labs{' '}
              </p>
            </div>
          </div>
          <div className="bg-helpmeblue py-4">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
              <p className="md:w-1/2">
                <b>Anytime Questions</b> - A discussion board/email replacement
                where students first get a chatbot answer and can then decide if
                they are satisfied or still need more help
              </p>
              <ImageCarousel
                images={[
                  {
                    src: ImageAnytimeQuestionsProfView,
                    alt: "Course home page with a Chatbot window open where the user is asking 'When is the midterm?' and the chatbot replying with 'The midterm exam is scheduled for Thursday, October 17, 2025, during the lab session' with a source saying Syllabus page 2",
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Course Chatbot
                        </h4>
                        <p className="text-sm">
                          Allows students to get course-relevant AI assistance
                          with precise source citations.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageAnytimeQuestionsCreateQuestion,
                    alt: 'Professor View',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Professor Analytics
                        </h4>
                        <p className="text-sm">
                          Enables professors to monitor chatbot activity, review
                          questions, and calibrate custom prompt context.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageAnytimeQuestionsQuestionCreated,
                    alt: 'Canvas Integration',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Canvas Auto-Sync
                        </h4>
                        <p className="text-sm">
                          Seamlessly syncs syllabus and course documents
                          directly from Canvas to feed the chatbot knowledge
                          base.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageAnytimeQuestionsProfEditResponse,
                    alt: 'Document Upload',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Document Drag & Drop
                        </h4>
                        <p className="text-sm">
                          Provides standard drag-and-drop file upload for
                          students and professors to add custom reference
                          materials.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageAnytimeQuestionsStudentWithCommentsOpen,
                    alt: 'Prof Insert Question As New Chunk',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          Knowledge Injection
                        </h4>
                        <p className="text-sm">
                          Injects specific, custom Q&As directly into the AI
                          chatbot&apos;s retrieval database for instant updates.
                        </p>
                      </div>
                    ),
                  },
                  {
                    src: ImageInsightsUsageOverTime,
                    alt: 'Prof Insert Question As New Chunk',
                    caption: (
                      <div>
                        <h4 className="mb-1 text-base font-bold">
                          TODO: put this someplace else
                        </h4>
                        <p className="text-sm">
                          Injects specific, custom Q&As directly into the AI
                          chatbot&apos;s retrieval database for instant updates.
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
          <ul className="mx-auto max-w-2xl list-disc pl-4 text-left">
            <li className="m-3">
              Primarily developed by students at UBC + UBCO
            </li>
            <li className="m-3">
              For new professors, please watch the video(s) below and contact
              Ramon Lawrence at{' '}
              <a href="mailto:ramon.lawrence@ubc.ca">ramon.lawrence@ubc.ca</a>{' '}
              for more information if interested
            </li>
          </ul>

          <Divider className="my-8" />

          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center">
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
