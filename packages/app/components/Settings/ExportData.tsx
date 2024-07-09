import { ReactElement, useState } from 'react'
import styled from 'styled-components'
type CourseRosterPageProps = { courseId: number }
import { API } from '@koh/api-client'
import { Button, message, Spin } from 'antd'
import csvDownload from 'json-to-csv-export'
const CourseRosterPageComponent = styled.div`
  width: 90%;
  margin-left: auto;
  margin-right: auto;
  padding-top: 50px;
`

export default function ExportData({
  courseId,
}: CourseRosterPageProps): ReactElement {
  const [loading, setLoading] = useState(false)

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      let questionData: any = await API.questions.getAllQuestions(courseId)
      // transform questionTypes to be a string csv
      questionData = questionData.map((question) => ({
        ...question,
        questionTypes: question.questionTypes
          .map((type) => type.name)
          .join(', '),
      }))
      const today = new Date()
      const dateString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD
      const formattedQuestionData = {
        data: questionData,
        filename: `all-questions-${dateString}`,
        delimiter: ',',
        headers: [
          'id',
          'AskerId',
          'text',
          'questionTypes',
          'createdAt',
          'helpedAt',
          'closedAt',
          'status',
          'location',
          'askerName',
          'helperName',
        ],
      }
      setLoading(false)
      return formattedQuestionData
    } catch (error) {
      message.error('Failed to fetch questions: ' + error.message)
      setLoading(false)
      return null
    }
  }

  return (
    <div>
      <CourseRosterPageComponent>
        <div style={{ textAlign: 'center' }}>
          <Button
            loading={loading}
            onClick={async () => {
              const formattedQuestionData = await fetchQuestions()
              if (formattedQuestionData) {
                csvDownload(formattedQuestionData)
              }
            }}
          >
            Download data of all questions
          </Button>
        </div>
      </CourseRosterPageComponent>
    </div>
  )
}
