import React from 'react'
import { Modal, Form, Input, DatePicker, FormInstance } from 'antd'

const { TextArea } = Input

interface SemesterModal {
  isSemesterModalOpen: boolean
  setIsSemesterModalOpen: (open: boolean) => void
  handleSubmit: () => void
  semesterForm: FormInstance<any>
  creatingSemester: boolean
}

export const SemesterModal: React.FC<SemesterModal> = ({
  isSemesterModalOpen,
  setIsSemesterModalOpen,
  handleSubmit,
  semesterForm,
  creatingSemester,
}) => {
  const handleCloseModal = () => {
    semesterForm.resetFields()
    setIsSemesterModalOpen(false)
  }

  return (
    <Modal
      title={`${creatingSemester ? 'Add New' : 'Edit'} Semester`}
      open={isSemesterModalOpen}
      onCancel={handleCloseModal}
      onOk={handleSubmit}
      okText="Save"
      cancelText="Cancel"
    >
      <Form layout="vertical" form={semesterForm}>
        <Form.Item
          label="Semester Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter the semester name' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Start Date"
          name="startDate"
          rules={[{ required: true, message: 'Please select a start date' }]}
        >
          <DatePicker />
        </Form.Item>
        <Form.Item
          label="End Date"
          name="endDate"
          rules={[{ required: true, message: 'Please select an end date' }]}
        >
          <DatePicker />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <TextArea rows={3} placeholder="Optional description" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
