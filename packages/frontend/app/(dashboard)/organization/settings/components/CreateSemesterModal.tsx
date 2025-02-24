import React from 'react'
import { Modal, Form, Input, DatePicker, FormInstance } from 'antd'

const { TextArea } = Input

interface CreateSemesterModalProps {
  isSemesterCreationModalOpen: boolean
  setIsSemesterCreationModalOpen: (open: boolean) => void
  handleAddSemester: () => void
  semesterForm: FormInstance<any>
}

export const CreateSemesterModal: React.FC<CreateSemesterModalProps> = ({
  isSemesterCreationModalOpen,
  setIsSemesterCreationModalOpen,
  handleAddSemester,
  semesterForm,
}) => {
  return (
    <Modal
      title="Add New Semester"
      visible={isSemesterCreationModalOpen}
      onCancel={() => setIsSemesterCreationModalOpen(false)}
      onOk={handleAddSemester}
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
