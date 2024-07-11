import { ReactElement, useState } from 'react'
import { API } from '@koh/api-client'
import { Button, message } from 'antd'
import csvDownload from 'json-to-csv-export'
import { StudentTaskProgressWithUser } from '@koh/common'
import { useCourse } from '../../hooks/useCourse'

type CourseRosterPageProps = { courseId: number }

export default function ExportData({
  courseId,
}: CourseRosterPageProps): ReactElement {
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const { course } = useCourse(courseId)

  const formatDateAndTimeForExcel = (date: Date): string => {
    // Ensure date is a Date object
    const validDate = typeof date === 'string' ? new Date(date) : date
    if (!validDate || isNaN(validDate.getTime())) return ''
    // Convert to local time and extract parts
    const localDate = new Date(
      validDate.getTime() - validDate.getTimezoneOffset() * 60000,
    )
    const [datePart, timePart] = localDate.toISOString().split('T')
    const timeString = timePart.split('.')[0] // Remove milliseconds
    return `${datePart} ${timeString}` // Format: YYYY-MM-DD HH:MM:SS
  }

  const fetchQuestions = async () => {
    setLoadingQuestions(true)
    try {
      const questionData = await API.questions.getAllQuestions(courseId)
      // need to format data since not all questions have helpName, location, helpedAt, closedAt, or questionTypes, which would cause the objects to be misaligned. The library we use expects all attributes to be defined and in the same order
      const formattedQuestionData = questionData.map((question) => ({
        question_id: question.id,
        queueId: question.queueId ?? '',
        creatorName: question.creatorName ?? '',
        text: question.text ?? '',
        // transform questionTypes to be a string csv
        questionTypes: question.questionTypes
          .map((type) => type.name)
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
      const courseNameNoSpecialChars = course.name.replace(/[^a-zA-Z0-9]/g, '')
      const questionDataWithCSVSettings = {
        data: formattedQuestionData,
        filename: `all-questions-${courseNameNoSpecialChars}-${dateString}`,
        delimiter: ',',
        // NOTE: when using csvDownload, the headers do NOT need to be the same as the keys in the data objects. The order the attributes come in the objects is what matters.
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
      message.error('Failed to fetch questions: ' + error.message)
      setLoadingQuestions(false)
      return null
    }
  }

  type Assignment = {
    assignmentId: string
    taskIds: string[]
  }

  type AssignmentsAndTasks = [Assignment[], string[]]

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
      const assignmentData =
        await API.studentTaskProgress.getAllTaskProgressForCourse(courseId)
      // need to transform data into rows of non-nested objects like [{assignment_id, student details, task1, task2, task3, part1, part2, part3, etc.},{...}]
      const assignmentsAndTasks = makeAssignments(assignmentData)
      const assignments = assignmentsAndTasks[0]
      const tasks = assignmentsAndTasks[1]
      const students = assignmentData.map(
        (studentTaskProgressWithUser) =>
          studentTaskProgressWithUser.userDetails,
      )

      const formattedAssignmentData = assignments.flatMap((assignment) => {
        return students.map((student) => {
          // Initialize the object with assignment ID and student details
          const rowObject = {
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
            // THIS ASSUMES THAT EVERY STUDENT WAS SUPPOSED TO DO THE ASSIGNMENT. Alternatively, we could put an empty string here to show that the student never started the assignment.
            if (
              !myStudentTaskProgress ||
              !myStudentTaskProgress[assignment.assignmentId] ||
              !myStudentTaskProgress[assignment.assignmentId].assignmentProgress
            ) {
              rowObject[taskId] = false
              return
            }
            const myAssignmentProgress =
              myStudentTaskProgress[assignment.assignmentId].assignmentProgress
            // if the student has made progress on the assignment, put false if they haven't done the task. Put the task's isDone value (which is always true as of now) if they have.
            if (!myAssignmentProgress[taskId]) {
              rowObject[taskId] = false
            } else {
              rowObject[taskId] = myAssignmentProgress[taskId].isDone
              if (myAssignmentProgress[taskId].isDone) {
                rowObject.tasksCompleted++
              }
            }
          })
          return rowObject
        })
      })

      const today = new Date()
      const dateString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
      const courseNameNoSpecialChars = course.name.replace(/[^a-zA-Z0-9]/g, '')
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
      message.error(
        'Failed to fetch/format student assignment progress: ' + error.message,
      )
      console.error(error)
      setLoadingAssignments(false)
      return null
    }
  }

  return (
    <div className="flex basis-auto flex-col items-center justify-start">
      <Button
        className="mb-8 mt-24"
        loading={loadingQuestions}
        onClick={async () => {
          const questionDataWithCSVSettings = await fetchQuestions()
          if (questionDataWithCSVSettings) {
            try {
              csvDownload(questionDataWithCSVSettings)
            } catch (error) {
              message.error(
                'Failed to download question data csv: ' + error.message,
              )
              console.error(error)
            }
          } else {
            message.error('Failed to format the data for download')
          }
        }}
      >
        Download csv of all questions
      </Button>
      <Button
        className="mb-2 mt-8"
        loading={loadingAssignments}
        onClick={async () => {
          const assignmentDataWithCSVSettings = await fetchStudentTaskProgress()
          if (assignmentDataWithCSVSettings) {
            try {
              csvDownload(assignmentDataWithCSVSettings)
            } catch (error) {
              message.error(
                'Failed to download assignment data csv: ' + error.message,
              )
              console.error(error)
            }
          } else {
            message.error('Failed to format the data for download')
          }
        }}
      >
        Download csv of all students&apos; assignment progress
      </Button>
      <div className="my-2 w-1/2 text-sm text-gray-500">
        Note: Assignment tasks that no student ever completed are not considered
        part of that assignment
      </div>
    </div>
  )
}
