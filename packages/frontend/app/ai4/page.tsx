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
  UsersRound,
  MessageCircleQuestion,
  LineChart,
} from 'lucide-react'
import { MailOutlined } from '@ant-design/icons'
import ImageCarousel from '../components/ImageCarousel'

export const metadata: Metadata = {
  title: 'HelpMe',
}

export default function Home(): ReactElement {
  const chatbotImages = [
    {
      src: ImageChatbotCourseHomePage,
      alt: "Course home page with a Chatbot window open where the user is asking 'When is the midterm?' and the chatbot replying with 'The midterm exam is scheduled for Thursday, October 17, 2025, during the lab session' with a source saying Syllabus page 2",
      caption: (
        <div>
          <h4 className="mb-1 text-base font-bold">
            Course Homepage with Chatbot{' '}
          </h4>
          <p className="text-sm">
            Here the student asks a question to the Course Chatbot where it
            returns a course-relevant response with a citation to the uploaded
            Syllabus. They also have the option to convert the question to an
            Anytime Question if they want further help from course staff or
            discuss with other students.
          </p>
        </div>
      ),
    },
    {
      src: ImageChatbotDocumentUpload,
      alt: 'A popup form asking the professor what documents they would like to upload to the Course Chatbot. The professor is dragging a lab manual file from their file system into the interface. There are several slide decks and other course documents that have been selected for upload.',
      caption: (
        <div>
          <h4 className="mb-1 text-base font-bold">Course Document Upload</h4>
          <p className="text-sm">
            A simple drag-n-drop! Supports bulk-upload and many file types
            (.pdf, .docx, .pptx, .xlsx, .csv, .txt, .md, and most image
            formats).
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
            HelpMe integrates with Canvas, allowing Canvas items to be
            automatically synchronized into your HelpMe Course Chatbot&apos;s
            Knowledge Base. Items include: Announcements, Assignments, Files,
            Pages, and Quizzes, with options to customize what items are
            synchronized. Also lets you compare what students are in your HelpMe
            course but not in your Canvas course, or vise-versa.
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
            Professors have access to the prompt and can include course-specific
            instructions, such as what the course is, what the goals of the
            course are (at a high level), how you want the chatbot to respond,
            and why it&apos;s important for the chatbot to respond that way to
            meet the course&apos;s goals. They can also choose different models
            for more advanced configuration.
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
            Chatbot questions are collected, stored on UBC hardware, and
            anonymized. Unlike other major AI platforms, this will allow you to
            see where your students are struggling <i>and</i> is student-data
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
            Found a place where the Chatbot responded poorly due to a gap in its
            Knowledge Base? Edit its response and then insert the Question and
            Answer back into the Knowledge Base!
          </p>
        </div>
      ),
    },
  ]

  const queueImages = [
    {
      src: ImageProfQueueOverview,
      alt: 'Queue interface (course-staff-view) with two questions in the queue. Each question has 4 buttons: delete, ask to rephrase, message student, and start helping. Each question also has a location (Online or In-Person), who is asking what, how long they were waiting for, and student-added question tags. Other buttons in the interface include: Check Out, Edit Queue Details, Add student to Queue, and an Away toggle. There are also professor-customized queue notes that say where the office is and a little module saying the queue is hybrid. There is also a list of staff in the queue, with the professor being listed as Available as they are not helping anyone yet.',
      caption: (
        <div>
          <h4 className="mb-1 text-base font-bold">
            Course Staff Queue Interface
          </h4>
          <p className="text-sm">
            Course Staff have many tools for managing questions in the queue,
            including: delete, ask to rephrase, message student, and start
            helping.
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
            In addition to the question text field, students can add
            professor-defined tags (useful for Insights) and whether they are
            asking the question In-Person or Online (for Hybrid queues).
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
            Once helping a question, course staff have the following options:
            requeue, can&apos;t find, done helping, and pause.
          </p>
        </div>
      ),
    },
    {
      src: ImageStudentGettingHelp,
      alt: 'Student view of being helped. There is a popup saying that the professor is ready for them now, and also states any professor-set queue notes. There are two buttons: "Join Meeting Now" (since the student is attending Online) and "Not Ready?"',
      caption: (
        <div>
          <h4 className="mb-1 text-base font-bold">Student Being Helped</h4>
          <p className="text-sm">
            Once helped, the student gets a popup and notification. In the case
            where the student is getting help online, they will have the option
            to join the online meeting. Any professor-set queue notes are also
            listed here in case the professor has additional instructions for
            the student.
          </p>
        </div>
      ),
    },
  ]

  const anytimeQuestionsImages = [
    {
      src: ImageAnytimeQuestionsProfView,
      alt: 'Course staff-view of the Anytime Question Hub. There are 3 questions, each posted by an anonymous animal (students appear anonymous to other students by default). One of the questions is public (visible to other students) and the other two are private and need attention (they were unhappy with their AI response). Some of these questions have comments but they are collapsed. There are filters to filter by what questions are verified/unverified and what questions are public/private. Staff also have a checkbox to unveil the authors of each question (for moderation purposes). Staff also have the option to delete questions or post an updated response.',
      caption: (
        <div>
          <h4 className="mb-1 text-base font-bold">
            Course Staff View of Anytime Questions
          </h4>
          <p className="text-sm">
            Here is a list of all the Anytime Questions students have asked. It
            shows which ones have been human verified vs which ones got an AI
            answer but still need help.
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
            When creating an Anytime Question or Comment, students are
            anonymized to other students by default. Course staff can still who
            posted what for moderation purposes. Professors can also configure
            it so that students have the option to post their questions publicly
            to other students (by default, all questions are private unless made
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
          <h4 className="mb-1 text-base font-bold">Student Question Created</h4>
          <p className="text-sm">
            Once created, the student can view the AI answer. They can then
            decide whether they are satisfied with the response or still need
            faculty help. Choosing the latter will send an email notification to
            the course staff to provide an answer.
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
            Course Staff can edit the AI&apos;s response and mark it as
            verified. Once saved, the student will be email notified. They also
            have the option to make the question visible to other students (the
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
          <h4 className="mb-1 text-base font-bold">Comments!</h4>
          <p className="text-sm">
            Anytime Questions also supports Comments, allowing course staff (or
            students for public questions) to continue the conversation.
          </p>
        </div>
      ),
    },
  ]

  const insightsImages = [
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
  ]

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-b-zinc-200 bg-white bg-white/95 shadow-sm backdrop-blur-md">
        <StandardPageContainer className="!pl-0">
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <main className="min-h-screen bg-[#f8f9fb] text-zinc-800">
        {/* Hero Section */}
        <div className="relative overflow-hidden py-16 text-center sm:py-24">
          <div className="ambient-glow pointer-events-none absolute inset-0" />

          <div className="animate-fade-in relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              Ethical AI & Student Support
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-5xl md:text-6xl">
              Welcome to{' '}
              <span className="text-gradient-helpme font-black">HelpMe</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base font-light text-zinc-500 sm:text-lg">
              A course help system designed to streamline assistance, manage
              queues, and provide safe AI support.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button
                type="primary"
                href="/login"
                size="large"
                className="flex h-12 items-center justify-center rounded-xl border-none px-8 font-semibold shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: 'rgb(var(--helpmeblue))' }}
                icon={<LogIn strokeWidth={2} size={18} className="mr-1" />}
              >
                Login
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Sections */}
        <StandardPageContainer className="space-y-16 px-4 py-12">
          {/* Feature 1: Course Chatbot */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-zinc-100/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8 lg:grid-cols-12 lg:p-12">
            <div className="space-y-6 lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-600">
                  <Bot size={28} strokeWidth={1.75} />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                    Platform Core
                  </span>
                  <h3 className="mt-0.5 text-2xl font-bold text-zinc-900 sm:text-3xl">
                    Course Chatbot
                  </h3>
                </div>
              </div>

              <p className="text-base font-light leading-relaxed text-zinc-600 sm:text-lg">
                Allows students to get course-relevant AI assistance
              </p>

              <ul className="space-y-3.5 text-sm text-zinc-700 sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>
                    Accessed by students via Invite Link or embeddable within
                    Canvas
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>Prompt is professor-customizable</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>
                    Hosted entirely on UBCO infrastructure — safe for student
                    data
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>
                    Supports drag-n-drop and automatic Canvas course document
                    upload
                  </span>
                </li>
              </ul>
            </div>
            <div className="w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:col-span-7">
              <ImageCarousel images={chatbotImages} />
            </div>
          </div>

          {/* Feature 2: Queueing System */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-zinc-100/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8 lg:grid-cols-12 lg:p-12">
            <div className="order-2 w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:order-1 lg:col-span-7">
              <ImageCarousel images={queueImages} />
            </div>
            <div className="order-1 space-y-6 lg:order-2 lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600">
                  <UsersRound size={28} strokeWidth={1.75} />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                    Office Hours
                  </span>
                  <h3 className="mt-0.5 text-2xl font-bold text-zinc-900 sm:text-3xl">
                    Queueing System
                  </h3>
                </div>
              </div>

              <p className="text-base font-light leading-relaxed text-zinc-600 sm:text-lg">
                Queueing system for managing Online/In-Person/Hybrid office
                hours or labs
              </p>

              <ul className="space-y-3.5 text-sm text-zinc-700 sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                  <span>
                    Supports Online, In-Person, and Hybrid queues for student
                    comfort
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                  <span>
                    Integrated notifications when course staff are ready to help
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                  <span>
                    Allows staff to message students, request rephrases, or
                    pause helping timers
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3: Anytime Questions */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-zinc-100/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8 lg:grid-cols-12 lg:p-12">
            <div className="space-y-6 lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-600">
                  <MessageCircleQuestion size={28} strokeWidth={1.75} />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-sky-600">
                    Async Learning
                  </span>
                  <h3 className="mt-0.5 text-2xl font-bold text-zinc-900 sm:text-3xl">
                    Anytime Questions
                  </h3>
                </div>
              </div>

              <p className="text-base font-light leading-relaxed text-zinc-600 sm:text-lg">
                A discussion board/email replacement where students first get a
                chatbot answer and can then decide if they are satisfied or
                still need more help
              </p>

              <ul className="space-y-3.5 text-sm text-zinc-700 sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                  <span>
                    Instant AI answers based directly on uploaded course
                    documents
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                  <span>
                    Easy escalation to faculty/TAs when more expert support is
                    needed
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                  <span>
                    Private by default with options to make verified questions
                    public to the class
                  </span>
                </li>
              </ul>
            </div>
            <div className="w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:col-span-7">
              <ImageCarousel images={anytimeQuestionsImages} />
            </div>
          </div>

          {/* Feature 4: Insights */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-zinc-100/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8 lg:grid-cols-12 lg:p-12">
            <div className="order-2 w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:order-1 lg:col-span-7">
              <ImageCarousel images={insightsImages} />
            </div>
            <div className="order-1 space-y-6 lg:order-2 lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-600">
                  <LineChart size={28} strokeWidth={1.75} />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-violet-600">
                    Analytics
                  </span>
                  <h3 className="mt-0.5 text-2xl font-bold text-zinc-900 sm:text-3xl">
                    Insights
                  </h3>
                </div>
              </div>

              <p className="text-base font-light leading-relaxed text-zinc-600 sm:text-lg">
                Insights for letting you see usage, what types of questions are
                being asked, and much more!
              </p>

              <ul className="space-y-3.5 text-sm text-zinc-700 sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                  <span>
                    Visualize system usage trends, queue wait times, and
                    workload over time
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                  <span>
                    Discover student struggle points by categorizing question
                    types
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                  <span>
                    Gain metrics on chatbot helpfulness compared to human
                    responses
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </StandardPageContainer>

        {/* Video Showcase Section */}
        <div className="border-y border-zinc-200/50 bg-[#f0f4f8] py-16">
          <StandardPageContainer className="px-4">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold text-zinc-900">
                Watch HelpMe in Action
              </h2>
              <p className="mt-2 font-light text-zinc-600">
                Explore walkthroughs and tutorials to see how HelpMe supports
                courses.
              </p>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
              {/* Video 1 */}
              <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div>
                  <h4 className="mb-1 text-lg font-semibold text-zinc-800">
                    HelpMe Overview
                  </h4>
                  <p className="mb-4 text-sm font-light text-zinc-500">
                    A quick high-level summary of the main features and goals.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-zinc-100 shadow-inner">
                  <div className="youtube-video-container">
                    <iframe
                      src="https://www.youtube.com/embed/H9ywkvDdeZ0?si=kmMPT9d1eBacKb6Y"
                      title="HelpMe Overview Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>

              {/* Video 2 */}
              <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div>
                  <h4 className="mb-1 text-lg font-semibold text-zinc-800">
                    Tutorial Walkthrough
                  </h4>
                  <p className="mb-4 text-sm font-light text-zinc-500">
                    Detailed step-by-step tutorial on how to navigate the
                    platform.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-zinc-100 shadow-inner">
                  <div className="youtube-video-container">
                    <iframe
                      src="https://www.youtube.com/embed/Y8v8HfEpkqo?si=ZgDnpjBhiIp1RRCT"
                      title="HelpMe Tutorial Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </div>
          </StandardPageContainer>
        </div>

        {/* Call-To-Action (CTA) & Bottom Footer section */}
        <div className="py-16 sm:py-24">
          <StandardPageContainer className="px-4">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-slate-900 via-zinc-950 to-slate-900 p-8 text-center text-white shadow-xl sm:p-12 md:p-16">
              <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

              <div className="animate-fade-in relative z-10 mx-auto max-w-2xl space-y-6">
                <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Interested in using it?
                </h3>

                <p className="text-base font-light leading-relaxed text-zinc-300 sm:text-lg">
                  HelpMe is completely free to add to your UBC courses. It was
                  primarily developed by students at UBC & UBCO.
                </p>

                <p className="text-sm font-light text-zinc-400">
                  For new professors, please watch the video walkthroughs and
                  contact Dr. Ramon Lawrence for more information if interested.
                </p>

                <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                  <Button
                    type="primary"
                    href="mailto:ramon.lawrence@ubc.ca"
                    size="large"
                    className="flex h-12 w-full items-center justify-center rounded-xl border-none bg-gradient-to-r from-blue-600 to-indigo-600 px-6 font-semibold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] sm:w-auto"
                    icon={<MailOutlined className="mr-1" />}
                  >
                    Contact Dr. Ramon Lawrence
                  </Button>

                  <Button
                    href="/about"
                    size="large"
                    className="flex h-12 w-full items-center justify-center rounded-xl border border-zinc-700 bg-transparent px-6 font-semibold text-zinc-200 transition-all duration-300 hover:border-zinc-500 hover:bg-zinc-800/40 hover:text-white sm:w-auto"
                  >
                    Meet the Team
                  </Button>
                </div>
              </div>
            </div>
          </StandardPageContainer>
        </div>
      </main>
    </>
  )
}
