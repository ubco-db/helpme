import { Card, Button, message, Tag } from 'antd'
import { useState } from 'react'
import { Form } from 'antd'
import { SemesterPartial } from '@koh/common'
import { API } from '@/app/api'
import { SemesterModal } from './SemesterModal'
import DeleteConfirmationModal from './DeleteConfirmationModal'
import dayjs from 'dayjs'

interface SemesterManagementProps {
  orgId: number
  organizationSemesters: SemesterPartial[]
  setOrganizationSemesters: (semesters: SemesterPartial[]) => void
}

export const SemesterManagement: React.FC<SemesterManagementProps> = ({
  orgId,
  organizationSemesters,
  setOrganizationSemesters,
}) => {
  const [currentSemesterId, setCurrentSemesterId] = useState<number>(-1) // -1 represents nothing being selected
  const [deletionSemesterName, setDeletionSemesterName] = useState<string>('')
  const [isSemesterCreationModalOpen, setIsSemesterCreationModalOpen] =
    useState(false)
  const [isSemesterEditModalOpen, setIsSemesterEditModalOpen] = useState(false)
  const [
    isConfirmSemesterDeleteModalOpen,
    setIsConfirmSemesterDeleteModalOpen,
  ] = useState(false)

  // for semester management
  const [semesterForm] = Form.useForm()

  const handleAddSemester = async () => {
    const formValues = await semesterForm.validateFields([
      'name',
      'startDate',
      'endDate',
      'color',
    ])
    const semesterName = formValues.name as string
    const semesterStartDate = formValues.startDate as dayjs.Dayjs
    const semesterEndDate = formValues.endDate as dayjs.Dayjs
    const semesterDescription = semesterForm.getFieldValue(
      'description',
    ) as string

    if (semesterName.length < 3) {
      message.error('Semester name must be at least 3 characters')
      return
    }

    if (semesterDescription && semesterDescription.length < 10) {
      message.error('Semester description must be at least 10 characters')
      return
    }

    if (semesterStartDate.valueOf() >= semesterEndDate.valueOf()) {
      message.error('Semester start date must be before end date')
      return
    }

    const semesterDetails: SemesterPartial = {
      name: semesterName,
      startDate: semesterStartDate.toDate(),
      endDate: semesterEndDate.toDate(),
      description: semesterDescription,
      color: formValues.color,
    }

    await API.semesters
      .create(orgId, semesterDetails)
      .then(() => {
        setIsSemesterCreationModalOpen(false)
        message.success('Semester created successfully')
        setOrganizationSemesters([...organizationSemesters, semesterDetails])
        semesterForm.resetFields()
      })
      .catch((error) => {
        message.error(error.response.data.message)
      })
  }

  const handleOpenEditSemesterModal = (semesterId: number) => {
    {
      const semester = organizationSemesters.find((s) => s.id === semesterId)
      if (!semester) {
        message.error('Semester not found')
        return
      }
      semesterForm.setFieldsValue({
        name: semester.name,
        startDate: dayjs(semester.startDate),
        endDate: dayjs(semester.endDate),
        description: semester.description,
        color: semester.color,
      })
      setCurrentSemesterId(semesterId)
      setIsSemesterEditModalOpen(true)
    }
  }

  const handleEditSemester = async () => {
    const formValues = await semesterForm.validateFields([
      'name',
      'startDate',
      'endDate',
      'color',
    ])
    const semesterName = formValues.name
    const semesterStartDate = formValues.startDate
    const semesterEndDate = formValues.endDate
    const semesterDescription = semesterForm.getFieldValue('description')

    if (semesterName.length < 3) {
      message.error('Semester name must be at least 3 characters')
      return
    }

    if (semesterDescription && semesterDescription.length < 10) {
      message.error('Semester description must be at least 10 characters')
      return
    }

    if (semesterStartDate >= semesterEndDate) {
      message.error('Semester start date must be before end date')
      return
    }

    const semesterDetails: SemesterPartial = {
      name: semesterName,
      startDate: semesterStartDate,
      endDate: semesterEndDate,
      description: semesterDescription || null,
      color: formValues.color,
    }

    await API.semesters
      .edit(orgId, currentSemesterId, semesterDetails)
      .then(() => {
        setIsSemesterEditModalOpen(false)
        setCurrentSemesterId(-1)
        message.success('Semester updated successfully')
        setOrganizationSemesters([...organizationSemesters, semesterDetails])
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  const handleConfirmSemesterDelete = (
    semesterId: number,
    semesterName: string,
  ) => {
    setCurrentSemesterId(semesterId)
    setDeletionSemesterName(semesterName)
    setIsConfirmSemesterDeleteModalOpen(true)
  }

  const handleDeleteSemester = async (semesterId: number) => {
    await API.semesters
      .delete(orgId, semesterId)
      .then(() => {
        setCurrentSemesterId(-1)
        setDeletionSemesterName('')
        message.success('Semester deleted successfully')
        setOrganizationSemesters(
          organizationSemesters.filter((s) => s.id !== semesterId),
        )
      })
      .catch((error) => {
        message.error(error.response.data.message)
      })
  }
  return (
    <Card
      title="Semester Management"
      variant="outlined"
      className="mb-10 w-full"
    >
      {organizationSemesters && organizationSemesters.length > 0 ? (
        organizationSemesters
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
          .map((semester) => (
            <Card.Grid
              key={semester.id}
              className="flex w-[50%] flex-col justify-between gap-2 text-center hover:cursor-pointer"
              onClick={() => handleOpenEditSemesterModal(semester.id!)}
            >
              <h3 className="text-lg font-semibold">{semester.name}</h3>
              <p>
                <span className="font-semibold">Start Date:</span>{' '}
                {semester.startDate.toDateString()}
              </p>
              <p>
                <span className="font-semibold">End Date:</span>{' '}
                {semester.endDate.toDateString()}
              </p>
              {semester.description && (
                <p>
                  <span className="font-semibold">Description:</span>{' '}
                  {semester.description}
                </p>
              )}
              <p>
                <span className="font-semibold">Color:</span>{' '}
                <Tag
                  color={semester.color}
                  bordered={false}
                  className="text-sm"
                >
                  {semester.color}
                </Tag>
              </p>
              <Button
                danger
                type="primary"
                onClick={(e) => {
                  e.stopPropagation()
                  handleConfirmSemesterDelete(semester.id!, semester.name)
                }}
                className="mt-2"
              >
                Delete
              </Button>
            </Card.Grid>
          ))
      ) : (
        <Card.Grid className="w-[50%] text-center">
          No semesters added yet. Click the button to add a new semester.
        </Card.Grid>
      )}

      <Card.Grid className="w-[50%] text-center">
        <Button
          type="dashed"
          onClick={() => setIsSemesterCreationModalOpen(true)}
        >
          + Add New Semester
        </Button>
      </Card.Grid>

      {isSemesterCreationModalOpen && (
        <SemesterModal
          isSemesterModalOpen={isSemesterCreationModalOpen}
          setIsSemesterModalOpen={setIsSemesterCreationModalOpen}
          handleSubmit={handleAddSemester}
          semesterForm={semesterForm}
          creatingSemester={true}
        />
      )}
      {isSemesterEditModalOpen && (
        <SemesterModal
          isSemesterModalOpen={isSemesterEditModalOpen}
          setIsSemesterModalOpen={setIsSemesterEditModalOpen}
          handleSubmit={handleEditSemester}
          semesterForm={semesterForm}
          creatingSemester={false}
        />
      )}
      {isConfirmSemesterDeleteModalOpen && (
        <DeleteConfirmationModal
          isOpen={isConfirmSemesterDeleteModalOpen}
          semesterName={deletionSemesterName}
          onConfirm={() => {
            handleDeleteSemester(currentSemesterId)
            setIsConfirmSemesterDeleteModalOpen(false)
          }}
          onCancel={() => setIsConfirmSemesterDeleteModalOpen(false)}
        />
      )}
    </Card>
  )
}
