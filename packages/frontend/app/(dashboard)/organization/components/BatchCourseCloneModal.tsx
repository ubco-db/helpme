import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  BatchCourseCloneAttributes,
  CourseCloneAttributes,
  CourseResponse,
  defaultCourseCloneAttributes,
  GetOrganizationResponse,
  OrganizationProfessor,
} from '@koh/common'
import { Button, Form, message, Modal } from 'antd'
import React, { useEffect, useState } from 'react'
import SelectCourses from './SelectCourses'
import DefaultCourseSettingsSelection from './DefaultCourseSettingsSelection'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import CustomizeCloneSettings from './CustomizeCloneSettings'

type BatchCourseCloneModalProps = {
  open: boolean
  onClose: () => void
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
  organization,
}) => {
  const [courses, setCourses] = useState<CourseResponse[]>([])
  const [professors, setProfessors] = useState<OrganizationProfessor[]>([])
  const [defaultCloneSettings, setDefaultCloneSettings] =
    useState<CourseCloneAttributes>({
      ...defaultCourseCloneAttributes,
      professorIds: [-1],
      useSection: false,
    })
  const [currentStep, setCurrentStep] = useState<CloneSteps>(
    CloneSteps.SelectCourses,
  )
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([])
  const [customCloneSettings, setCustomCloneSettings] =
    useState<BatchCourseCloneAttributes>({})
  const [defaultSettingsForm] = Form.useForm<CourseCloneAttributes>()

  useEffect(() => {
    const fetchProfessors = async () => {
      API.organizations.getProfessors(organization.id).then((professors) => {
        setProfessors(professors)
      })
    }
    // have to fetch all courses (without pagination) since need to allow for admin to "clone all courses" if they wanted to
    const fetchCourses = async () => {
      API.organizations.getCourses(organization.id).then((courses) => {
        setCourses(courses)
      })
    }
    fetchProfessors()
    fetchCourses()
  }, [organization.id])

  const handleBatchClone = async () => {
    API.organizations
      .batchCloneCourses(organization.id, customCloneSettings)
      .then((res) => {
        message.success('Course cloning job scheduled successfully!')
        setCurrentStep(CloneSteps.SelectCourses)
        setSelectedCourseIds([])
        setDefaultCloneSettings({
          ...defaultCourseCloneAttributes,
          professorIds: [-1],
          useSection: false,
        })
        setCustomCloneSettings({})
        onClose()
      })
      .catch((err) => {
        message.error(
          'Error occurred while scheduling course cloning job: ' + err.message,
        )
      })
  }

  const getModalTitle = () => {
    switch (currentStep) {
      case CloneSteps.SelectCourses:
        return 'Batch Course Clone - Select Courses'
      case CloneSteps.DefaultSettings:
        return 'Batch Course Clone - Default Settings'
      case CloneSteps.CustomizeCourses:
        return 'Batch Course Clone - Customize Courses'
      case CloneSteps.FinalConfirmation:
        return 'Batch Course Clone - Confirmation'
      default:
        return 'Batch Course Clone'
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case CloneSteps.SelectCourses: {
        return (
          <SelectCourses
            courses={courses}
            selectedCourseIds={selectedCourseIds}
            setSelectedCourseIds={setSelectedCourseIds}
            organizationSemesters={organization.semesters}
          />
        )
      }
      case CloneSteps.DefaultSettings:
        return (
          <DefaultCourseSettingsSelection
            defaultValues={defaultCloneSettings}
            organization={organization}
            form={defaultSettingsForm}
          />
        )
      case CloneSteps.CustomizeCourses:
        return (
          <>
            <CustomizeCloneSettings
              courses={courses}
              selectedCourseIds={selectedCourseIds}
              defaultCloneSettings={defaultCloneSettings}
              customCloneSettings={customCloneSettings}
              setCustomCloneSettings={setCustomCloneSettings}
              organization={organization}
            />
          </>
        )
      case CloneSteps.FinalConfirmation:
        return (
          <div className="flex h-full w-full justify-center">
            <div className="flex flex-col gap-2">
              <h2>Final Confirmation</h2>
              <p>
                Due to the heavy processing that comes with cloning courses in a
                batch, you will be notified via email when the cloning process
                is done with a summary of courses that have been successfully
                cloned, and any courses that might have had issues.
              </p>
              <p>
                Click the &apos;Clone All&apos; button below to start the batch
                cloning process.
              </p>
            </div>
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
              if (selectedCourseIds.length === 0) {
                message.warning('Please select at least one course to clone')
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
                const settings: CourseCloneAttributes =
                  defaultSettingsForm.getFieldsValue()
                // Loose equality to check that value is null OR undefined
                if (settings.newSemesterId == null) {
                  message.warning('Please select a new semester to clone to')
                  return
                }

                setDefaultCloneSettings((prev) => ({ ...prev, ...settings }))
                setCurrentStep((prev: CloneSteps) => prev + 1)
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
              onClick={() => setCurrentStep((prev: CloneSteps) => prev - 1)}
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

  return courses ? (
    <Modal
      title={getModalTitle()}
      open={open}
      onCancel={onClose}
      footer={renderFooter()}
      width={
        currentStep === CloneSteps.CustomizeCourses
          ? {
              xs: '95%',
              sm: '90%',
              md: '85%',
              lg: '80%',
              xl: '75%',
              xxl: '70%',
            }
          : {
              xs: '90%',
              sm: '85%',
              md: '80%',
              lg: '70%',
              xl: '65%',
              xxl: '50%',
            }
      }
      destroyOnHidden={true}
      maskClosable={false}
      styles={{
        content: {
          height:
            currentStep === CloneSteps.FinalConfirmation ? '20rem' : '90vh',
        },
        body: {
          overflowY: 'auto',
          height: 'calc(100% - 4rem)',
        },
        footer: {
          zIndex: '15',
          position: 'absolute',
          bottom: '0',
          right: '0',
          padding: '1rem',
          width: '100%',
          boxSizing: 'border-box',
          background: 'white',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
        },
      }}
    >
      {renderStepContent()}
    </Modal>
  ) : (
    <CenteredSpinner tip="Loading courses..." />
  )
}

export default BatchCourseCloneModal
