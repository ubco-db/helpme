'use client'

import { Button, Checkbox, Form, Modal, Segmented, message, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import csvDownload from 'json-to-csv-export'
import * as Sentry from '@sentry/nextjs'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ToolUsageExportData, ToolUsageType } from '@koh/common'

type ToolUsageExportModalProps = {
  courseId: number
  visible: boolean
  onCancel: () => void
  onFinish?: () => void
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

type FormValues = {
  includeQueueQuestions: boolean
  includeAnytimeQuestions: boolean
  includeChatbotInteractions: boolean
  groupBy: 'day' | 'week'
  includeBreakdown: boolean
}

const ToolUsageExportModal: React.FC<ToolUsageExportModalProps> = ({
  courseId,
  visible,
  onCancel,
  onFinish,
}) => {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)

  const handleExport = async (values: FormValues) => {
    const { includeQueueQuestions, includeAnytimeQuestions, includeChatbotInteractions, groupBy, includeBreakdown } = values

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
      if (onFinish) {
        onFinish()
      } else {
        onCancel()
      }
    } catch (error) {
      console.error('Failed to export tool usage data:', error)
      const errorMessage = getErrorMessage(error)
      
      Sentry.captureException(
        new Error(
          `Tool usage export failed for course ${courseId}.`,
        ),
      )
      
      message.error(`Failed to export tool usage data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
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
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          Create Export
        </Button>,
      ]}
      width={600}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleExport}
        initialValues={{
          includeQueueQuestions: true,
          includeAnytimeQuestions: true,
          includeChatbotInteractions: true,
          groupBy: 'week',
          includeBreakdown: false,
        }}
      >
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium mb-3">What constitutes as tool usage?</legend>
            <div className="space-y-2">
              <Form.Item 
                name="includeQueueQuestions" 
                valuePropName="checked" 
                className="mb-2"
                dependencies={['includeAnytimeQuestions', 'includeChatbotInteractions']}
                rules={[
                  {
                    validator: async (_, value) => {
                      const { includeAnytimeQuestions, includeChatbotInteractions } = form.getFieldsValue()
                      if (!value && !includeAnytimeQuestions && !includeChatbotInteractions) {
                        throw new Error('Please select at least one tool type to export')
                      }
                    },
                  },
                ]}
              >
                <Checkbox>Queue Questions</Checkbox>
              </Form.Item>
              <Form.Item 
                name="includeAnytimeQuestions" 
                valuePropName="checked" 
                className="mb-2"
                dependencies={['includeQueueQuestions', 'includeChatbotInteractions']}
              >
                <Checkbox>Anytime Questions</Checkbox>
              </Form.Item>
              <Form.Item 
                name="includeChatbotInteractions" 
                valuePropName="checked" 
                className="mb-0"
                dependencies={['includeQueueQuestions', 'includeAnytimeQuestions']}
              >
                <Checkbox>Chatbot Interactions</Checkbox>
              </Form.Item>
            </div>
          </fieldset>

          <Form.Item name="groupBy" label="Tool uses by day or by week?" className="mb-0">
            <Segmented
              options={[
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
              ]}
            />
          </Form.Item>

          <Form.Item name="includeBreakdown" valuePropName="checked" className="mb-0">
            <Checkbox>
              Include breakdown by tool type (separate sections for each tool)
            </Checkbox>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default ToolUsageExportModal
