import React, { useState, useEffect } from 'react'
import { Modal, Input, Button } from 'antd'

interface DeleteConfirmationProps {
  isOpen: boolean
  semesterName: string
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationProps> = ({
  isOpen: visible,
  semesterName,
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (visible) setInputValue('')
  }, [visible])

  const isMatch = inputValue === semesterName

  return (
    <Modal
      title="Confirm Delete Semester"
      className="text-center"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          disabled={!isMatch}
          onClick={onConfirm}
        >
          Delete
        </Button>,
      ]}
    >
      <p className="mb-4">
        Deleting a semester will automatically set all affiliated courses to
        having no semester. To confirm deletion, please type the name of the
        semester (<span className="font-semibold">{semesterName}</span>) below:
      </p>
      <Input
        placeholder="Type semester name here"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
    </Modal>
  )
}

export default DeleteConfirmationModal
