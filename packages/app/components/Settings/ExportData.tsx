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

  const fetchQuestions = async () => {
    setLoadingQuestions(true)
    try {
      let questionData: any = await API.questions.getAllQuestions(courseId)
      // transform questionTypes to be a string csv
      questionData = questionData.map((question) => ({
        ...question,
        questionTypes: question.questionTypes
          .map((type) => type.name)
          .join(', '),
      }))
      console.log(questionData)
      const today = new Date()
      const dateString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
      const courseNameNoSpecialChars = course.name.replace(/[^a-zA-Z0-9]/g, '')
      const questionDataWithCSVSettings = {
        data: questionData,
        filename: `all-questions-${courseNameNoSpecialChars}-${dateString}`,
        delimiter: ',',
        headers: [
          'id',
          'queueId',
          'creatorName',
          'text',
          'questionTypes',
          'createdAt',
          'helpedAt',
          'closedAt',
          'status',
          'location',
          'helpName',
          'isTaskQuestion',
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
    <div className="flex flex-col items-center justify-start">
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
        className="mb-4 mt-8"
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
      <div className="max-w-1/2 my-4 text-sm text-gray-500">
        Note: Since the tasks can be different in a queue but have the same
        assignment ID, the tasks defined in the CSV will be based on the tasks
        students have completed. This means that a task that was never once
        completed by any student will not show up for that assignment in the
        CSV.
      </div>
    </div>
  )
}
