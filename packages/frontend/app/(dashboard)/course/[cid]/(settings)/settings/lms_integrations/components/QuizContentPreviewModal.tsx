'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Modal, Select, Spin, Typography } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { LMSQuiz, LMSQuizAccessLevel } from '@koh/common'
import { API } from '@/app/api'

const { Option } = Select
const { Text } = Typography

interface QuizContentPreviewModalProps {
  quiz: LMSQuiz
  courseId: number
  currentAccessLevel: LMSQuizAccessLevel
  open: boolean
  onClose: () => void
}

const ACCESS_LEVEL_LABELS = {
  [LMSQuizAccessLevel.LOGISTICS_ONLY]: 'Logistics Only',
  [LMSQuizAccessLevel.LOGISTICS_AND_QUESTIONS]: 'Logistics & Questions',
  [LMSQuizAccessLevel.LOGISTICS_QUESTIONS_GENERAL_COMMENTS]:
    'Logistics, Questions & Comments',
  [LMSQuizAccessLevel.FULL_ACCESS]: 'Full Access',
}

const ACCESS_LEVEL_DESCRIPTIONS = {
  [LMSQuizAccessLevel.LOGISTICS_ONLY]:
    'Only basic quiz information (title, due dates, time limits)',
  [LMSQuizAccessLevel.LOGISTICS_AND_QUESTIONS]:
    'Basic info + question text (no answers)',
  [LMSQuizAccessLevel.LOGISTICS_QUESTIONS_GENERAL_COMMENTS]:
    'Basic info + questions + general comments',
  [LMSQuizAccessLevel.FULL_ACCESS]:
    'Complete quiz content including answers and feedback',
}

export const QuizContentPreviewModal: React.FC<
  QuizContentPreviewModalProps
> = ({ quiz, courseId, currentAccessLevel, open, onClose }) => {
  const [selectedAccessLevel, setSelectedAccessLevel] =
    useState<LMSQuizAccessLevel>(currentAccessLevel)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedAccessLevel(currentAccessLevel)
      fetchPreview(currentAccessLevel)
    }
  }, [open, currentAccessLevel])

  const fetchPreview = async (accessLevel: LMSQuizAccessLevel) => {
    setLoading(true)
    setError(null)

    try {
      const response = await API.lmsIntegration.getQuizContentPreview(
        courseId,
        quiz.id,
        accessLevel,
      )
      setPreviewContent(response.content)
    } catch (err) {
      setError('Failed to load preview content')
      console.error('Preview error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccessLevelChange = (accessLevel: LMSQuizAccessLevel) => {
    setSelectedAccessLevel(accessLevel)
    fetchPreview(accessLevel)
  }

  return (
    <Modal
      centered
      title={
        <div>
          <EyeOutlined style={{ marginRight: 8 }} />
          Chatbot Content Preview: {quiz.title}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>Access Level:</Text>
        </div>
        <Select
          value={selectedAccessLevel}
          onChange={handleAccessLevelChange}
          style={{ width: '100%', marginBottom: 8 }}
        >
          {Object.values(LMSQuizAccessLevel).map((level) => (
            <Option key={level} value={level}>
              {ACCESS_LEVEL_LABELS[level]}
            </Option>
          ))}
        </Select>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {ACCESS_LEVEL_DESCRIPTIONS[selectedAccessLevel]}
        </Text>
      </div>

      {selectedAccessLevel !== currentAccessLevel && (
        <Alert
          message="Preview Mode"
          description={`This shows what the chatbot would see if access level was changed to "${ACCESS_LEVEL_LABELS[selectedAccessLevel]}". Current level is "${ACCESS_LEVEL_LABELS[currentAccessLevel]}".`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {selectedAccessLevel === currentAccessLevel && (
        <Alert
          message="Preview Mode"
          description={`This is the current access level for this quiz.`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ marginBottom: 8 }}>
        <Text strong>Content that will be sent to the chatbot:</Text>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading preview...</div>
        </div>
      ) : error ? (
        <Alert message="Error" description={error} type="error" showIcon />
      ) : (
        <div
          style={{
            backgroundColor: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            padding: '16px',
            maxHeight: '400px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
          }}
        >
          {previewContent || 'No content available for this access level.'}
        </div>
      )}
    </Modal>
  )
}

export default QuizContentPreviewModal
