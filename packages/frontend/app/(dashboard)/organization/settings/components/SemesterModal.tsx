import React, { useState } from 'react'
import { DatePicker, Form, FormInstance, Input, Modal, Select, Tag } from 'antd'
import { antdTagColor } from '@koh/common'

const { TextArea } = Input

interface SemesterModalProps {
  isSemesterModalOpen: boolean
  setIsSemesterModalOpen: (open: boolean) => void
  handleSubmit: () => Promise<void>
  semesterForm: FormInstance<any>
  creatingSemester: boolean
}

export const SemesterModal: React.FC<SemesterModalProps> = ({
  isSemesterModalOpen,
  setIsSemesterModalOpen,
  handleSubmit,
  semesterForm,
  creatingSemester,
}) => {
  const [isSaveLoading, setIsSaveLoading] = useState(false)
  const handleCloseModal = () => {
    semesterForm.resetFields()
    setIsSemesterModalOpen(false)
  }

  return (
    <Modal
      centered
      title={`${creatingSemester ? 'Add New' : 'Edit'} Semester`}
      open={isSemesterModalOpen}
      onCancel={handleCloseModal}
      onOk={async () => {
        setIsSaveLoading(true)
        await handleSubmit()
        setIsSaveLoading(false)
      }}
      okText="Save"
      cancelText="Cancel"
      confirmLoading={isSaveLoading}
    >
      <Form
        layout="vertical"
        form={semesterForm}
        initialValues={{
          color: antdTagColor.blue,
        }}
      >
        <Form.Item
          label="Semester Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter the semester name' },
          ]}
        >
          <Input placeholder="2025W Term 1" />
        </Form.Item>
        <Form.Item label="Start Date" name="startDate" layout="horizontal">
          <DatePicker />
        </Form.Item>
        <Form.Item label="End Date" name="endDate" layout="horizontal">
          <DatePicker />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
          tooltip="Optional description. Do note that this description is visible to students too"
        >
          <TextArea rows={3} placeholder="Optional description" />
        </Form.Item>
        <Form.Item
          label="Colour"
          name="color"
          layout="horizontal"
          tooltip="The colour of the semester labels on the card view on the Courses page"
          rules={[{ required: true, message: 'Please select a colour' }]}
        >
          <Select
            options={Object.values(antdTagColor).map((color) => ({
              label: (
                <Tag color={color} bordered={false} className="text-sm">
                  {color}
                </Tag>
              ),
              value: color,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
