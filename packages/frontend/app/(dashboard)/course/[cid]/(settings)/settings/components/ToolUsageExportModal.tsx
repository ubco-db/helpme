'use client'

import { Button, Checkbox, Modal, Segmented, message } from 'antd'
import { useState } from 'react'
import csvDownload from 'json-to-csv-export'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

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

  const handleError = (error: any, context: string) => {
    console.error(`${context}:`, error)
    const errorMessage = getErrorMessage(error)
    message.error(`${context}: ${errorMessage}`)
  }

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
      
      const toolsString = [
        includeQueueQuestions && 'queue',
        includeAnytimeQuestions && 'anytime questions',
        includeChatbotInteractions && 'chatbot'
      ].filter(Boolean).join(', ')
      

      const toolData = new Map()
      const timePeriods = new Set()
      
      data.forEach((row: any) => {
        const toolKey = row.tool_type
        if (!toolData.has(toolKey)) {
          toolData.set(toolKey, [])
        }
        toolData.get(toolKey).push(row)
        timePeriods.add(row.period_date)
      })
      
      const sortedPeriods = Array.from(timePeriods).sort()
      const toolTypes = Array.from(toolData.keys()).sort()
      const formattedData = []
      
      // Process each tool type and collect data for aggregation
      const allStudentData = new Map()
      const toolSections = []
      
      toolTypes.forEach(toolType => {
        const toolRows = toolData.get(toolType)
        const studentData = new Map()
        
        toolRows.forEach((row: any) => {
          const studentKey = `${row.user_id}_${row.firstName}_${row.lastName}_${row.email}`
          const timeKey = row.period_date
          
          if (!studentData.has(studentKey)) {
            studentData.set(studentKey, {
              user_id: row.user_id,
              firstName: row.firstName || '',
              lastName: row.lastName || '',
              email: row.email || '',
              periods: new Map()
            })
          }
          
          const currentCount = studentData.get(studentKey).periods.get(timeKey) || 0
          studentData.get(studentKey).periods.set(timeKey, currentCount + row.count)
        })
        
        // Store this tool's data for aggregation
        toolSections.push({ toolType, studentData: Array.from(studentData.values()) })
        
        // Add to aggregated data
        Array.from(studentData.values()).forEach(student => {
          const studentKey = `${student.user_id}_${student.firstName}_${student.lastName}_${student.email}`
          
          if (!allStudentData.has(studentKey)) {
            allStudentData.set(studentKey, {
              user_id: student.user_id,
              firstName: student.firstName,
              lastName: student.lastName,
              email: student.email,
              periods: new Map()
            })
          }
          
          // Add this tool's counts to the aggregated data
          student.periods.forEach((count, period) => {
            const currentCount = allStudentData.get(studentKey).periods.get(period) || 0
            allStudentData.get(studentKey).periods.set(period, currentCount + count)
          })
        })
      })
      
      // Add aggregated section first
      formattedData.push({
        'User ID': '[AGGREGATED - ALL TOOLS]',
        'First Name': '',
        'Last Name': '',
        'Email': '',
        ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
      })
      
      Array.from(allStudentData.values()).forEach(student => {
        const row: any = {
          'User ID': student.user_id,
          'First Name': student.firstName,
          'Last Name': student.lastName,
          'Email': student.email
        }
        
        sortedPeriods.forEach(period => {
          row[period] = student.periods.get(period) || 0
        })
        
        formattedData.push(row)
      })
      
      // Add empty row between sections
      formattedData.push({
        'User ID': '',
        'First Name': '',
        'Last Name': '',
        'Email': '',
        ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
      })
      
      // Add individual tool type sections
      toolSections.forEach(({ toolType, studentData }) => {
        // Add section header
        formattedData.push({
          'User ID': `[${toolType.toUpperCase()}]`,
          'First Name': '',
          'Last Name': '',
          'Email': '',
          ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
        })
        
        // Add data for this tool type
        studentData.forEach(student => {
          const row: any = {
            'User ID': student.user_id,
            'First Name': student.firstName,
            'Last Name': student.lastName,
            'Email': student.email
          }
          
          sortedPeriods.forEach(period => {
            row[period] = student.periods.get(period) || 0
          })
          
          formattedData.push(row)
        })
        
        // Add empty row between sections
        formattedData.push({
          'User ID': '',
          'First Name': '',
          'Last Name': '',
          'Email': '',
          ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
        })
      })
      
      const csvData = {
        data: formattedData,
        filename: `Tool Usage for ${courseName} (${toolsString}) - ${new Date().toISOString().split('T')[0]}.csv`,
        delimiter: ',',
        headers: ['User ID', 'First Name', 'Last Name', 'Email', ...sortedPeriods]
      }

      csvDownload(csvData)
      message.success('Tool usage data exported successfully! Single CSV file with separate sections for each tool type created.')
      onCancel()
    } catch (error) {
      handleError(error, 'Failed to export tool usage data')
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
