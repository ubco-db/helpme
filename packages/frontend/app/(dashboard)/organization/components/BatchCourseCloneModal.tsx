import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  CourseCloneAttributes,
  CourseResponse,
  defaultCourseCloneAttributes,
  GetOrganizationResponse,
  OrganizationProfessor,
} from '@koh/common'
import { Button, message, Modal } from 'antd'
import React, { useEffect, useState } from 'react'
import SelectCourses from './SelectCourses'
import CourseSettingsSelection from './CourseSettingsSelection'

type BatchCourseCloneModalProps = {
  open: boolean
  onClose: () => void
  courses: CourseResponse[]
  organization: GetOrganizationResponse
}

enum CloneSteps {
  SelectCourses = 0,
  DefaultSettings = 1,
  CustomizeCourses = 2,
  FinalConfirmation = 3,
}

// This feature only allows for cloning to another semester
// (batch cloning different sections for the same semester is not a common use case)

const BatchCourseCloneModal: React.FC<BatchCourseCloneModalProps> = ({
  open,
  onClose,
  courses,
  organization,
}) => {
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [defaultCloneSettings, setDefaultCloneSettings] =
    useState<CourseCloneAttributes>(defaultCourseCloneAttributes)
  const [currentStep, setCurrentStep] = useState<CloneSteps>(
    CloneSteps.SelectCourses,
  )
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])
  const [customCourseSettings, setCustomCourseSettings] = useState<
    Record<string, CourseCloneAttributes>
  >({})

  const { userInfo, setUserInfo } = useUserInfo()

  useEffect(() => {
    const fetchProfessors = async () => {
      if (!userInfo.organization?.id) {
        return
      }

      await API.organizations
        .getProfessors(userInfo.organization?.id)
        .then((response) => {
          setProfessors(response ?? [])
        })
        .catch((error) => {
          message.error(error.response.data.message)
          setProfessors([])
        })
    }
    fetchProfessors()
  }, [organization.id])

  const handleBatchClone = async () => {
    API.organizations
      .batchCloneCourses(organization.id, customCourseSettings)
      .then((res) => {
        message.success('Course cloning job scheduled successfully!')
        setCurrentStep(CloneSteps.SelectCourses)
        setSelectedCourses([])
        setDefaultCloneSettings(defaultCourseCloneAttributes)
        setCustomCourseSettings({})
        onClose()
      })
      .catch((err) => {
        message.error(
          'Error occurred while scheduling course cloning job: ' + err.message,
        )
      })
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case CloneSteps.SelectCourses: {
        // Inline component for selecting courses
        return (
          <SelectCourses
            courses={courses}
            selectedCourses={selectedCourses}
            setSelectedCourses={setSelectedCourses}
            organizationSemesters={organization.semesters}
          />
        )
      }
      case CloneSteps.DefaultSettings:
        return (
          <CourseSettingsSelection
            professors={professors}
            defaultValues={defaultCloneSettings}
            onDone={(defaultAttributes) =>
              setDefaultCloneSettings(defaultAttributes)
            }
            organizationSemesters={organization.semesters}
          />
        )
      case CloneSteps.CustomizeCourses:
        return (
          <>
            {/* Last component to build for multi-step cloning wizard modal */}
          </>
        )
      case CloneSteps.FinalConfirmation:
        return (
          <div className="flex h-full w-full items-center justify-center">
            <h2>Final Confirmation</h2>
            <p>
              Due to the heavy processing that comes with cloning courses in a
              batch, you will be notified via email when the cloning process is
              done with a summary of courses that have been successfully cloned,
              and any courses that might have had issues.{' '}
            </p>
            <p>
              Click the &apos;Clone All&apos; button below to start the batch
              cloning process.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  const renderFooter = () => {
    switch (currentStep) {
      case CloneSteps.SelectCourses:
        return (
          <Button
            key="next"
            type="primary"
            onClick={() => {
              if (selectedCourses.length === 0) {
                message.warning('Please select at least one course to clone.')
                return
              }
              setCurrentStep((prev: CloneSteps) => prev + 1)
            }}
          >
            Next
          </Button>
        )

      case CloneSteps.DefaultSettings:
        return (
          <>
            <Button
              key="back"
              onClick={() => setCurrentStep((prev: CloneSteps) => prev - 1)}
            >
              Back
            </Button>
            <Button
              key="next"
              type="primary"
              onClick={async () => {
                try {
                  setCurrentStep((prev: CloneSteps) => prev + 1)
                } catch (err) {
                  message.error('Please fix the form errors.')
                }
              }}
            >
              Next
            </Button>
          </>
        )

      case CloneSteps.CustomizeCourses:
        return (
          <>
            <Button
              key="back"
              onClick={() => setCurrentStep((prev: CloneSteps) => prev - 1)}
            >
              Back
            </Button>
            <Button
              key="next"
              type="primary"
              onClick={() => setCurrentStep((prev: CloneSteps) => prev + 1)}
            >
              Next
            </Button>
          </>
        )

      case CloneSteps.FinalConfirmation:
        return (
          <>
            <Button
              key="back"
              onClick={() => setCurrentStep((prev: CloneSteps) => prev + 1)}
            >
              Back
            </Button>
            <Button key="finish" type="primary" onClick={handleBatchClone}>
              Clone All
            </Button>
          </>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      title="Batch Course Clone"
      open={open}
      onCancel={onClose}
      footer={renderFooter()}
      width={{
        xs: '90%',
        sm: '85%',
        md: '80%',
        lg: '70%',
        xl: '65%',
        xxl: '50%',
      }}
      destroyOnClose
      maskClosable={false}
    >
      {renderStepContent()}
    </Modal>
  )
}

export default BatchCourseCloneModal
