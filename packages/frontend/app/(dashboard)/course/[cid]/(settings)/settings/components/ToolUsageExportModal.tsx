'use client'

import { Button, Checkbox, Modal, Segmented, message } from 'antd'
import { useState } from 'react'
import csvDownload from 'json-to-csv-export'
import { API } from '@/app/api'

type ToolUsageExportModalProps = {
  courseId: number
  visible: boolean
  onCancel: () => void
}

const ToolUsageExportModal: React.FC<ToolUsageExportModalProps> = ({
  courseId,
  visible,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false)
  const [includeQueueQuestions, setIncludeQueueQuestions] = useState(true)
  const [includeAnytimeQuestions, setIncludeAnytimeQuestions] = useState(true)
  const [includeChatbotInteractions, setIncludeChatbotInteractions] = useState(true)
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('week')

  const handleExport = async () => {
    // Check if at least one tool type is selected
    if (!includeQueueQuestions && !includeAnytimeQuestions && !includeChatbotInteractions) {
      message.error('Please select at least one tool type to export')
      return
    }

    setLoading(true)
    try {
      const data = await API.course.exportToolUsage(
        courseId,
        includeQueueQuestions,
        includeAnytimeQuestions,
        includeChatbotInteractions,
        groupBy
      )
      
      const courseName = data[0].course_name
      const formattedData = data.map((row: any) => ({
        user_id: row.user_id,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        email: row.email || '',
        course_name: row.course_name || '',
        tool_type: row.tool_type,
        date: row.period_date,
        time: row.period_time, 
        count: row.count
      }))

      const csvData = {
        data: formattedData,
        filename: `Tool usage export data for ${courseName} -${new Date().toISOString().split('T')[0]}.csv`,
        delimiter: ',',
        headers: ['User ID', 'First Name', 'Last Name', 'Email', 'Course Name', 'Tool Type', 'Date', 'Time', 'Count']
      }

      csvDownload(csvData)
      message.success('Tool usage data exported successfully')
      onCancel()
    } catch (error) {
      console.error('Export error:', error)
      message.error('Failed to export tool usage data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Export Tool Usage to CSV"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          loading={loading}
          onClick={handleExport}
        >
          Create Export
        </Button>,
      ]}
      width={600}
    >
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium mb-3">Select what to include in the export</h4>
          <div className="space-y-2">
            <Checkbox
              checked={includeQueueQuestions}
              onChange={(e) => setIncludeQueueQuestions(e.target.checked)}
            >
              Queue Questions
            </Checkbox>
            <br />
            <Checkbox
              checked={includeAnytimeQuestions}
              onChange={(e) => setIncludeAnytimeQuestions(e.target.checked)}
            >
              Anytime Questions
            </Checkbox>
            <br />
            <Checkbox
              checked={includeChatbotInteractions}
              onChange={(e) => setIncludeChatbotInteractions(e.target.checked)}
            >
              Chatbot Interactions
            </Checkbox>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Select the time period to export</h4>
          <Segmented
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
            ]}
            value={groupBy}
            onChange={(value) => setGroupBy(value as 'day' | 'week')}
          />
        </div>
      </div>
    </Modal>
  )
}

export default ToolUsageExportModal
