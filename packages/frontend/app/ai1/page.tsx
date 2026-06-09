import { Button } from 'antd'
import { Metadata } from 'next'
import { ReactElement } from 'react'
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
import ImageAnytimeQuestionsCreateQuestion from '@/public/actually_public/images/helpme_anytime_questions_create_question.png'
import ImageAnytimeQuestionsProfEditResponse from '@/public/actually_public/images/helpme_anytime_questions_prof_edit_response.png'
import ImageAnytimeQuestionsProfView from '@/public/actually_public/images/helpme_anytime_questions_prof_view.png'
import ImageAnytimeQuestionsQuestionCreated from '@/public/actually_public/images/helpme_anytime_questions_question_created.png'
import ImageAnytimeQuestionsStudentWithCommentsOpen from '@/public/actually_public/images/helpme_anytime_questions_student_with_comments_open.png'
import ImageInsightsUsageOverTime from '@/public/actually_public/images/helpme_insights_usage_over_time.png'
import ImageInsightsQuestionTypesOverTime from '@/public/actually_public/images/helpme_insights_question_types_over_time.png'
import ImageInsightsMostActiveTimes from '@/public/actually_public/images/helpme_insights_most_active_times.png'

import StandardPageContainer from '../components/standardPageContainer'
import HeaderBar from '../components/HeaderBar'
import {
  LogIn,
  Bot,
  Users,
  MessageSquareCode,
  LineChart,
  Sparkles,
} from 'lucide-react'
import ImageCarousel from '../components/ImageCarousel'

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
      <main className="ambient-glow min-h-screen pb-16">
        {/* Hero Section */}
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#3684c4]"></span>
            UBC Open-Source Research
          </div>

          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Welcome to{' '}
            <span className="text-gradient-helpme font-black">HelpMe</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg font-medium text-slate-600 md:text-xl">
            A Course Help System
          </p>

          <div className="mt-8 flex justify-center">
            <Button
              type="primary"
              href="/login"
              size="large"
              className="flex !h-12 items-center gap-2 !rounded-full !border-none !bg-[#3684c4] !px-8 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#5fa0d5] hover:shadow-xl hover:shadow-blue-500/20"
              icon={<LogIn strokeWidth={1.8} size={18} />}
            >
              Login
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Main Features
            </h2>
            <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-[#3684c4]"></div>
          </div>

          <div className="space-y-12 md:space-y-16">
            {/* Feature 1: Course Chatbot */}
            <div className="group flex flex-col items-center justify-between gap-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md md:flex-row md:gap-12 md:p-10">
              <div className="flex w-full flex-col text-left md:flex-1 md:pr-4">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[#3684c4]">
                  <Bot size={24} strokeWidth={2} />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-800">
                  Course Chatbot
                </h3>
                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-600">
                  Allows students to get course-relevant AI assistance
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>
                      Accessed by students via Invite Link or embeddable within
                      Canvas
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>Prompt is professor-customizable</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>
                      Hosted entirely on UBCO infrastructure - Safe for student
                      data
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>
                      Supports drag-n-drop and automatic Canvas course document
                      upload
                    </span>
                  </li>
                </ul>
              </div>
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 md:flex-1">
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
                            Chatbot where it returns a course-relevant response
                            with a citation to the uploaded Syllabus. They also
                            have the option to convert the question to an
                            Anytime Question if they want further help from
                            course staff or discuss with other students.
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
                            Announcements, Assignments, Files, Pages, and
                            Quizzes, with options to customize what items are
                            synchronized. Also lets you compare what students
                            are in your HelpMe course but not in your Canvas
                            course, or vise-versa.
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
                            Professors have access to the prompt and can include
                            course-specific instructions, such as what the
                            course is, what the goals of the course are (at a
                            high level), how you want the chatbot to respond,
                            and why it&apos;s important for the chatbot to
                            respond that way to meet the course&apos;s goals.
                            They can also choose different models for more
                            advanced configuration.
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
                            Found a place where the Chatbot responded poorly due
                            to a gap in its Knowledge Base? Edit its response
                            and then insert the Question and Answer back into
                            the Knowledge Base!
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            {/* Feature 2: Queueing system */}
            <div className="group flex flex-col-reverse items-center justify-between gap-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md md:flex-row md:gap-12 md:p-10">
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 md:flex-1">
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
                            Course Staff have many tools for managing questions
                            in the queue, including: delete, ask to rephrase,
                            message student, and start helping.
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
                            In addition to the question text field, students can
                            add professor-defined tags (useful for Insights) and
                            whether they are asking the question In-Person or
                            Online (for Hybrid queues).
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
                            notes are also listed here in case the professor has
                            additional instructions for the student.
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
              <div className="flex w-full flex-col text-left md:flex-1 md:pl-4">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[#3684c4]">
                  <Users size={24} strokeWidth={2} />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-800">
                  Queueing System
                </h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  Used for managing Online/In-Person/Hybrid office hours or labs
                </p>
              </div>
            </div>

            {/* Feature 3: Anytime Questions */}
            <div className="group flex flex-col items-center justify-between gap-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md md:flex-row md:gap-12 md:p-10">
              <div className="flex w-full flex-col text-left md:flex-1 md:pr-4">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[#3684c4]">
                  <MessageSquareCode size={24} strokeWidth={2} />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-800">
                  Anytime Questions
                </h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  A discussion board/email replacement where students first get
                  a chatbot answer and can then decide if they are satisfied or
                  still need more help
                </p>
              </div>
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 md:flex-1">
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
                            Here is a list of all the Anytime Questions students
                            have asked. It shows which ones have been human
                            verified vs which ones got an AI answer but still
                            need help.
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
                            default. Course staff can still who posted what for
                            moderation purposes. Professors can also configure
                            it so that students have the option to post their
                            questions publicly to other students (by default,
                            all questions are private unless made public by
                            course staff).
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
                            They can then decide whether they are satisfied with
                            the response or still need faculty help. Choosing
                            the latter will send an email notification to the
                            course staff to provide an answer.
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
                            mark it as verified. Once saved, the student will be
                            email notified. They also have the option to make
                            the question visible to other students (the student
                            will still be anonymized).
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
              </div>
            </div>

            {/* Feature 4: Insights */}
            <div className="group flex flex-col-reverse items-center justify-between gap-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md md:flex-row md:gap-12 md:p-10">
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 md:flex-1">
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
              </div>
              <div className="flex w-full flex-col text-left md:flex-1 md:pl-4">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[#3684c4]">
                  <LineChart size={24} strokeWidth={2} />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-800">
                  Insights
                </h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  Insights for letting you see usage, what types of questions
                  are being asked, and much more!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Overview/Videos Section */}
        <div className="mt-24 border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid grid-cols-1 items-start gap-12 text-left md:grid-cols-2">
              {/* Project Info Block */}
              <div className="space-y-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#3684c4] shadow-sm">
                  <Sparkles size={20} strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-800">
                  UBC Research Project
                </h3>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>Primarily developed by students at UBC + UBCO</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3684c4]" />
                    <span>
                      For new professors, please watch the video(s) and contact
                      Ramon Lawrence at{' '}
                      <a
                        href="mailto:ramon.lawrence@ubc.ca"
                        className="font-semibold text-[#3684c4] hover:underline"
                      >
                        ramon.lawrence@ubc.ca
                      </a>{' '}
                      for more information if interested. It&apos;s free to add
                      to your UBC courses.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Videos Column */}
              <div className="space-y-8">
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3684c4]" />
                    HelpMe Overview
                  </h4>
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
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
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3684c4]" />
                    Tutorial Videos
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      (Just one right now, more coming soon)
                    </span>
                  </h4>
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
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
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
