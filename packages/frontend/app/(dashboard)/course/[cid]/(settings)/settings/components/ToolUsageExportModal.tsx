'use client'

import { Button, Checkbox, Modal, Segmented, message, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import csvDownload from 'json-to-csv-export'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ToolUsageExportData } from '@koh/common'

type ToolUsageExportModalProps = {
  courseId: number
  visible: boolean
  onCancel: () => void
}

type StudentData = {
  user_id: number
  firstName: string
  lastName: string
  email: string
  periods: Map<string, number>
}

type CSVRow = {
  'User ID': string | number
  'First Name': string
  'Last Name': string
  'Email': string
  [key: string]: string | number
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
  const [includeBreakdown, setIncludeBreakdown] = useState(false)


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
      
      if (!data || data.length === 0) {
        message.warning('No tool usage data found for the selected criteria')
        onCancel()
        return
      }
      
      const courseName = data[0].course_name
      
      const toolsString = [
        includeQueueQuestions && 'queue',
        includeAnytimeQuestions && 'anytime questions',
        includeChatbotInteractions && 'chatbot'
      ].filter(Boolean).join(', ')
      

      const timePeriods = new Set<string>()
      const students = new Map<string, StudentData>()
      
      data.forEach((row) => {
        timePeriods.add(row.period_date)
        
        const studentKey = `${row.user_id}_${row.firstName}_${row.lastName}_${row.email}`
        if (!students.has(studentKey)) {
          students.set(studentKey, {
            user_id: row.user_id,
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            email: row.email || '',
            periods: new Map<string, number>()
          })
        }
      })
      
      const sortedPeriods = Array.from(timePeriods).sort()
      const formattedData: CSVRow[] = []
      
      if (includeBreakdown) {

        const toolData = new Map<string, ToolUsageExportData[]>()
        
        data.forEach((row) => {
          const toolKey = row.tool_type
          if (!toolData.has(toolKey)) {
            toolData.set(toolKey, [])
          }
          toolData.get(toolKey)?.push(row)
        })
        
        const toolTypes = Array.from(toolData.keys()).sort()
        

        toolTypes.forEach(toolType => {
          const toolRows = toolData.get(toolType) || []
          const studentData = new Map<string, StudentData>()
          
          toolRows.forEach((row) => {
            const studentKey = `${row.user_id}_${row.firstName}_${row.lastName}_${row.email}`
            const timeKey = row.period_date
            
            if (!studentData.has(studentKey)) {
              studentData.set(studentKey, {
                user_id: row.user_id,
                firstName: row.firstName || '',
                lastName: row.lastName || '',
                email: row.email || '',
                periods: new Map<string, number>()
              })
            }
            
            const student = studentData.get(studentKey)
            if (student) {
              const currentCount = student.periods.get(timeKey) || 0
              student.periods.set(timeKey, currentCount + Number(row.count))
            }
          })

          formattedData.push({
            'User ID': `[${toolType.toUpperCase()}]`,
            'First Name': '',
            'Last Name': '',
            'Email': '',
            ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
          })
          

          Array.from(studentData.values()).forEach(student => {
            const row: CSVRow = {
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
          
          formattedData.push({
            'User ID': '',
            'First Name': '',
            'Last Name': '',
            'Email': '',
            ...Object.fromEntries(sortedPeriods.map(period => [period, '']))
          })
        })
      } else {
        const allStudentData = new Map<string, StudentData>()
        
        data.forEach((row) => {
          const studentKey = `${row.user_id}_${row.firstName}_${row.lastName}_${row.email}`
          const timeKey = row.period_date
          
          if (!allStudentData.has(studentKey)) {
            allStudentData.set(studentKey, {
              user_id: row.user_id,
              firstName: row.firstName || '',
              lastName: row.lastName || '',
              email: row.email || '',
              periods: new Map<string, number>()
            })
          }
          
          const student = allStudentData.get(studentKey)
          if (student) {
            const currentCount = student.periods.get(timeKey) || 0
            student.periods.set(timeKey, currentCount + Number(row.count))
          }
        })
        
        Array.from(allStudentData.values()).forEach(student => {
          const row: CSVRow = {
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
      }
      
      const csvData = {
        data: formattedData,
        filename: `Tool Usage for ${courseName} (${toolsString}) - ${new Date().toISOString().split('T')[0]}.csv`,
        delimiter: ',',
        headers: ['User ID', 'First Name', 'Last Name', 'Email', ...sortedPeriods]
      }

      csvDownload(csvData)
      
      // Show the date range that was used
      const dateRange = sortedPeriods.length > 0 
        ? `Date range: ${sortedPeriods[0]} to ${sortedPeriods[sortedPeriods.length - 1]}`
        : 'No data found for the selected criteria'
      
      message.success(`Tool usage data exported successfully! ${dateRange}`)
      onCancel()
    } catch (error) {
      console.error('Failed to export tool usage data:', error)
      const errorMessage = getErrorMessage(error)
      message.error(`Failed to export tool usage data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <div className="flex items-center w-full">
          <span className="flex-1">Export Tool Usage to CSV</span>
          <div className="flex items-center gap-3 mr-6">
            <Tooltip
              title="You can export the usage data to see how much each student is using the system (e.g. for participation marks). Students are rows, and each week or day are the columns. Each cell is how many times a tool was used for that day/week by that student."
            >
              <div className="cursor-help text-gray-500 hover:text-gray-600">
                 Help <InfoCircleOutlined />
              </div>
            </Tooltip>
          </div>
        </div>
      }
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
          <h4 className="text-sm font-medium mb-3">What constitutes as a &quot;tool usage&quot;?</h4>
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
          <h4 className="text-sm font-medium mb-3">Tool uses by day or by week?</h4>
          <Segmented
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
            ]}
            value={groupBy}
            onChange={(value) => setGroupBy(value as 'day' | 'week')}
          />
        
        </div>

        <div>
          <div className="space-y-2">
            <Checkbox
              checked={includeBreakdown}
              onChange={(e) => setIncludeBreakdown(e.target.checked)}
            >
              Include breakdown by tool type (separate sections for each tool)
            </Checkbox>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ToolUsageExportModal
