'use client'

import { DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Button, message, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import csvDownload from 'json-to-csv-export'
import { API } from '@/app/api'
import {
  GetCourseResponse,
  questions,
  StudentTaskProgressWithUser,
} from '@koh/common'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import ToolUsageExportModal from './ToolUsageExportModal'

type CourseExportDataProps = {
  courseId: number
}

type Assignment = {
  assignmentId: string
  taskIds: string[]
}

type AssignmentsAndTasks = [Assignment[], string[]]

type FormattedAssignmentData = {
  assignmentId: string
  studentName: string | undefined
  studentSid: number | undefined
  studentEmail: string | undefined
  totalAssignmentTasks: number
  tasksCompleted: number
  [key: string]: any // Index signature for dynamic task keys
}

const CourseExportData: React.FC<CourseExportDataProps> = ({ courseId }) => {
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [course, setCourse] = useState<GetCourseResponse>()
  const [toolUsageModalVisible, setToolUsageModalVisible] = useState(false)

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const courseData = await API.course.get(courseId)
        setCourse(courseData)
      } catch (error) {
        message.error('Failed to fetch course')
      }
    }

    fetchCourse()
  }, [courseId])

  const fetchQuestions = async () => {
    setLoadingQuestions(true)

    try {
      const questionData: questions[] =
        await API.questions.getAllQuestions(courseId)
      // need to format data since not all questions have helpName, location, helpedAt, closedAt, or questionTypes,
      // which would cause the objects to be misaligned. The library we use expects all attributes to be defined and in the same order
      const formattedQuestionData = questionData.map((question) => ({
        question_id: question.id,
        queueId: question.queueId ?? '',
        creatorName: question.creatorName ?? '',
        text: question.text ?? '',
        // transform questionTypes to be a string csv
        questionTypes: question.questionTypes
          ?.map((type: { name: string }) => type.name)
          .join(', '),
        isTaskQuestion: question.isTaskQuestion ?? false,
        createdAt: formatDateAndTimeForExcel(question.createdAt),
        helpedAt: formatDateAndTimeForExcel(question.helpedAt),
        closedAt: formatDateAndTimeForExcel(question.closedAt),
        status: question.status ?? '',
        helperName: question.helpName ?? '',
        location: question.location ?? '',
      }))

      const today = new Date()
      const dateString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
      const courseNameNoSpecialChars = course?.name.replace(/[^a-zA-Z0-9]/g, '')

      const questionDataWithCSVSettings = {
        data: formattedQuestionData,
        filename: `all-questions-${courseNameNoSpecialChars}-${dateString}`,
        delimiter: ',',
        // NOTE: when using csvDownload, the headers do NOT need to be the same as the keys in the data objects.
        // The order the attributes come in the objects is what matters.
        headers: [
          'question_id',
          'queueId',
          'creatorName',
          'text',
          'questionTypes',
          'isTaskQuestion',
          'createdAt',
          'helpedAt',
          'closedAt',
          'status',
          'helperName',
          'location',
        ],
      }
      setLoadingQuestions(false)
      return questionDataWithCSVSettings
    } catch (error) {
      message.error('Failed to fetch questions')
      setLoadingQuestions(false)
      return null
    }
  }

  const makeAssignments = (
    assignmentData: StudentTaskProgressWithUser[],
  ): AssignmentsAndTasks => {
    const assignmentKeys = Array.from(
      new Set(
        assignmentData.flatMap((studentTaskProgressWithUser) =>
          Object.keys(studentTaskProgressWithUser.taskProgress || {}),
        ),
      ),
    )
    const seenTasksAcrossAllAssignments: Set<string> = new Set()
    // for each assignment key, go through all StudentTaskProgress objects and append unseen tasks to the list
    const assignments = assignmentKeys.map((assignmentKey): Assignment => {
      const seenTasks: Set<string> = new Set()
      assignmentData.forEach((studentTaskProgressWithUser) => {
        const studentTaskProgress = studentTaskProgressWithUser.taskProgress
        if (!studentTaskProgress || !studentTaskProgress[assignmentKey]) {
          return
        }
        const assignmentProgress =
          studentTaskProgress[assignmentKey].assignmentProgress
        Object.keys(assignmentProgress).forEach((taskId) => {
          if (!seenTasks.has(taskId)) {
            seenTasks.add(taskId)
            if (!seenTasksAcrossAllAssignments.has(taskId)) {
              seenTasksAcrossAllAssignments.add(taskId)
            }
          }
        })
      })
      return {
        assignmentId: assignmentKey,
        taskIds: Array.from(seenTasks),
      }
    })
    return [assignments, Array.from(seenTasksAcrossAllAssignments)]
  }

  const fetchStudentTaskProgress = async () => {
    setLoadingAssignments(true)

    try {
      const assignmentData: StudentTaskProgressWithUser[] =
        await API.studentTaskProgress.getAllTaskProgressForCourse(courseId)

      // need to transform data into rows of non-nested objects like
      // [{assignment_id, student details, task1, task2, task3, part1, part2, part3, etc.},{...}]

      const assignmentsAndTasks = makeAssignments(assignmentData)
      const assignments = assignmentsAndTasks[0]
      const tasks = assignmentsAndTasks[1]
      const students = assignmentData.map(
        (studentTaskProgressWithUser) =>
          studentTaskProgressWithUser.userDetails,
      )

      const formattedAssignmentData: FormattedAssignmentData[] =
        assignments.flatMap((assignment) => {
          return students.map((student) => {
            // Initialize the object with assignment ID and student details
            const rowObject: FormattedAssignmentData = {
              assignmentId: assignment.assignmentId,
              studentName: student.name,
              studentSid: student.sid,
              studentEmail: student.email,
              totalAssignmentTasks: assignment.taskIds.length,
              tasksCompleted: 0,
            }

            // Add task progress to the object
            // for each global task
            tasks.forEach((taskId) => {
              // If the assignment does not contain the task, just put an empty string.
              if (!assignment.taskIds.includes(taskId)) {
                rowObject[taskId] = ''
                return
              }

              const myStudentTaskProgress = assignmentData.find(
                (studentTaskProgressWithUser) =>
                  studentTaskProgressWithUser.userDetails.id === student.id,
              )?.taskProgress
              // if the student has never made progress on this assignment, put false
              // THIS ASSUMES THAT EVERY STUDENT WAS SUPPOSED TO DO THE ASSIGNMENT.
              // Alternatively, we could put an empty string here to show that the student never started the assignment.
              if (
                !myStudentTaskProgress ||
                !myStudentTaskProgress[assignment.assignmentId] ||
                !myStudentTaskProgress[assignment.assignmentId]
                  .assignmentProgress
              ) {
                rowObject[taskId] = false
                return
              }

              const myAssignmentProgress =
                myStudentTaskProgress[assignment.assignmentId]
                  .assignmentProgress

              // if the student has made progress on the assignment, put false if they haven't done the task.
              // Put the task's isDone value (which is always true as of now) if they have.
              if (!myAssignmentProgress[taskId]) {
                rowObject[taskId] = false
              } else {
                rowObject[taskId] = myAssignmentProgress[taskId]?.isDone

                if (myAssignmentProgress[taskId]?.isDone) {
                  rowObject.tasksCompleted++
                }
              }
            })
            return rowObject
          })
        })

      const today = new Date()
      const dateString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
      const courseNameNoSpecialChars = course?.name.replace(/[^a-zA-Z0-9]/g, '')
      const assignmentDataWithCSVSettings = {
        data: formattedAssignmentData,
        filename: `all-assignment-progress-${courseNameNoSpecialChars}-${dateString}`,
        delimiter: ',',
        headers: [
          'assignmentId',
          'studentName',
          'studentSid',
          'studentEmail',
          'totalAssignmentTasks',
          'tasksCompleted',
          ...tasks,
        ],
      }
      setLoadingAssignments(false)
      return assignmentDataWithCSVSettings
    } catch (error) {
      message.error('Failed to fetch/format student assignment progress')
      setLoadingAssignments(false)
      return null
    }
  }

  return (
    course && (
      <div className="space-y-7">
        <div className="flex items-center justify-between">
          <span> Export all queue questions in CSV</span>
          <Button
            loading={loadingQuestions}
            onClick={async () => {
              const questionDataWithCSVSettings = await fetchQuestions()
              if (questionDataWithCSVSettings) {
                try {
                  csvDownload(questionDataWithCSVSettings)
                } catch {
                  message.error('Failed to format the data for download')
                }
              } else {
                message.error('Failed to format the data for download')
              }
            }}
          >
            <DownloadOutlined />
            Download
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span>
            Export Tool Usage to CSV
            <Tooltip
              title="You can export the usage data to see how much each student is using the system (e.g. for participation marks). Students are rows, and each week or day are the columns. Each cell is how many times a tool was used for that day/week by that student."
            >
              <InfoCircleOutlined className="ml-2" />
            </Tooltip>
          </span>
          <Button
            onClick={() => setToolUsageModalVisible(true)}
          >
            <DownloadOutlined />
            Download
          </Button>
        </div>

        <div className="flex items-center justify-between align-middle">
          <span>
            Export CSV of all students&apos; assignment progress
            <Tooltip
              title={`This has to do with how you can give an assignment ID to queues with tasks that can be checked off (as opposed to regular questions). View the "Edit Queue Modal" on a queue page and hover the help icons for "Assignment ID" and "Tasks" for more information. This is not related to the LMS Assignment Synchronization feature (that is only used to upload assignments into the chatbot)`}
            >
              <InfoCircleOutlined className="ml-2" />
            </Tooltip>
          </span>
          <Button
            className=""
            loading={loadingAssignments}
            onClick={async () => {
              const assignmentDataWithCSVSettings =
                await fetchStudentTaskProgress()
              if (assignmentDataWithCSVSettings) {
                try {
                  csvDownload(assignmentDataWithCSVSettings)
                } catch {
                  message.error('Failed to format the data for download')
                }
              } else {
                message.error('Failed to format the data for download')
              }
            }}
          >
            <DownloadOutlined />
            Download
          </Button>
        </div>

        <ToolUsageExportModal
          courseId={courseId}
          visible={toolUsageModalVisible}
          onCancel={() => setToolUsageModalVisible(false)}
        />
      </div>
    )
  )
}

export default CourseExportData
