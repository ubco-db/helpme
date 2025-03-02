'use client'

import { EditOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
} from 'antd'
import TextArea from 'antd/es/input/TextArea'
import dayjs from 'dayjs'
import { ReactElement, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { Organization } from '@/app/typings/organization'
import { API } from '@/app/api'
import Image from 'next/image'
import ImageCropperModal from '@/app/(dashboard)/components/ImageCropperModal'
import { SemesterPartial } from '@koh/common'
import { SemesterModal } from './components/SemesterModal'
import DeleteConfirmationModal from './components/DeleteConfirmationModal'

export default function SettingsPage(): ReactElement {
  const [formGeneral] = Form.useForm()

  const [isCropperModalOpen, setIsCropperModalOpen] = useState<{
    logo: boolean
    banner: boolean
  }>({ logo: false, banner: false })
  const [isUploadingImg, setUploadingImg] = useState<{
    logo: boolean
    banner: boolean
  }>({ logo: false, banner: false })
  const { userInfo } = useUserInfo()
  const [organization, setOrganization] = useState<Organization>()
  const [organizationName, setOrganizationName] = useState(organization?.name)
  const [organizationDescription, setOrganizationDescription] = useState(
    organization?.description,
  )
  const [organizationWebsiteUrl, setOrganizationWebsiteUrl] = useState(
    organization?.websiteUrl,
  )
  const [organizationSemesters, setOrganizationSemesters] = useState<
    SemesterPartial[]
  >([])
  const [currentSemesterId, setCurrentSemesterId] = useState<number>(-1) // -1 represents nothing being selected
  const [deletionSemesterName, setDeletionSemesterName] = useState<string>('')
  const [isSemesterCreationModalOpen, setIsSemesterCreationModalOpen] =
    useState(false)
  const [isSemesterEditModalOpen, setIsSemesterEditModalOpen] = useState(false)
  const [
    isConfirmSemesterDeleteModalOpen,
    setIsConfirmSemesterDeleteModalOpen,
  ] = useState(false)
  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await API.organizations.get(
        Number(userInfo?.organization?.orgId) ?? -1,
      )

      setOrganization(response)
      setOrganizationName(response.name)
      setOrganizationDescription(response.description)
      setOrganizationWebsiteUrl(response.websiteUrl)
      setOrganizationSemesters(
        response.semesters.map((s: SemesterPartial) => {
          return {
            id: s.id,
            name: s.name,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
            description: s.description,
          }
        }),
      )
    }

    fetchDataAsync()
  }, [organization?.name, userInfo?.organization?.orgId])

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch (_) {
      return false
    }
  }

  const updateGeneral = async () => {
    const formValues = await formGeneral.validateFields()
    const organizationNameField = formValues.organizationName
    const organizationDescriptionField = formValues.organizationDescription
    const organizationWebsiteUrlField = formValues.organizationWebsiteUrl

    if (
      organizationNameField === organizationName &&
      organizationDescriptionField === organizationDescription &&
      organizationWebsiteUrlField === organizationWebsiteUrl
    ) {
      message.info(
        'Organization was not updated as information has not been changed',
      )
      return
    }

    if (organizationNameField.length < 3) {
      message.error('Organization name must be at least 3 characters')
      return
    }

    if (organizationDescriptionField.length < 10) {
      message.error('Organization description must be at least 10 characters')
      return
    }

    if (
      organizationWebsiteUrlField &&
      !isValidUrl(organizationWebsiteUrlField)
    ) {
      message.error(
        'Organization URL must be at least 4 characters and be a valid URL',
      )
      return
    }

    await API.organizations
      .patch(organization?.id ?? -1, {
        name: organizationNameField,
        description: organizationDescriptionField,
        websiteUrl: organizationWebsiteUrlField,
      })
      .then((_) => {
        setOrganizationName(organizationNameField)
        setOrganizationDescription(organizationDescriptionField)
        setOrganizationWebsiteUrl(organizationWebsiteUrlField)
        message.success('Organization information was updated')
        setTimeout(() => {
          window.location.reload()
        }, 1750)
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  // for semester management
  const [semesterForm] = Form.useForm()

  const handleAddSemester = async () => {
    const formValues = await semesterForm.validateFields()
    const semesterName = formValues.name as string
    const semesterStartDate = formValues.startDate as dayjs.Dayjs
    const semesterEndDate = formValues.endDate as dayjs.Dayjs
    const semesterDescription = formValues.description as string

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
    }

    await API.semesters
      .create(organization?.id ?? -1, semesterDetails)
      .then(() => {
        setIsSemesterCreationModalOpen(false)
        message.success('Semester created successfully')
        setOrganizationSemesters((prev) => [...prev, semesterDetails])
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
      })
      setCurrentSemesterId(semesterId)
      setIsSemesterEditModalOpen(true)
    }
  }

  const handleEditSemester = async () => {
    const formValues = await semesterForm.validateFields()
    const semesterName = formValues.name
    const semesterStartDate = formValues.startDate
    const semesterEndDate = formValues.endDate
    const semesterDescription = formValues.description

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
      description: semesterDescription,
    }

    await API.semesters
      .edit(organization?.id ?? -1, currentSemesterId, semesterDetails)
      .then(() => {
        setIsSemesterEditModalOpen(false)
        setCurrentSemesterId(-1)
        message.success('Semester updated successfully')
        setOrganizationSemesters((prev) => {
          const index = prev.findIndex((s) => s.id === semesterDetails.id)
          prev[index] = semesterDetails
          return prev
        })
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
      .delete(organization?.id ?? -1, semesterId)
      .then(() => {
        setCurrentSemesterId(-1)
        setDeletionSemesterName('')
        message.success('Semester deleted successfully')
        setOrganizationSemesters((prev) =>
          prev.filter((s) => s.id !== semesterId),
        )
      })
      .catch((error) => {
        message.error(error.response.data.message)
      })
  }

  return organization ? (
    <div className="flex flex-col items-center gap-3">
      <Card title="General" bordered={true} className="w-full">
        <Form
          form={formGeneral}
          onFinish={updateGeneral}
          layout="vertical"
          initialValues={{
            organizationName: organizationName,
            organizationDescription: organizationDescription,
            organizationWebsiteUrl: organizationWebsiteUrl,
          }}
        >
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col xs={{ span: 24 }} sm={{ span: 12 }}>
              <Form.Item
                label="Organization Name"
                name="organizationName"
                tooltip="Name of your organization"
              >
                <Input allowClear={true} defaultValue={organizationName} />
              </Form.Item>
            </Col>

            <Col xs={{ span: 24 }} sm={{ span: 12 }}>
              <Form.Item
                label="Organization Website URL"
                name="organizationWebsiteUrl"
                tooltip="Website URL of your organization"
              >
                <Input
                  allowClear={true}
                  defaultValue={organizationWebsiteUrl}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Organization Description"
            name="organizationDescription"
            tooltip="Description of your organization"
          >
            <TextArea
              defaultValue={organizationDescription}
              rows={4}
              style={{ resize: 'none' }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Update
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Logo & Banner" bordered={true} className="w-full">
        <Form layout="vertical">
          <Row className="flex justify-around">
            <Form.Item label="Logo">
              <Form.Item
                name="organizationLogo"
                className="flex justify-center"
              >
                <Col className="flex flex-col items-center justify-center">
                  <Row className="min-h-[300px]">
                    <Image
                      unoptimized
                      width={300}
                      height={300}
                      alt="Organization Logo"
                      src={`/api/v1/organization/${organization?.id}/get_logo/${organization?.logoUrl}`}
                    />
                  </Row>
                  <Row>
                    <ImageCropperModal
                      isOpen={isCropperModalOpen.logo}
                      circular={false}
                      aspect={1}
                      imgName="Organization Logo"
                      postURL={`/api/v1/organization/${organization?.id}/upload_logo`}
                      onUpdateComplete={() => {
                        setTimeout(() => {
                          window.location.reload()
                        }, 1750)
                      }}
                      setUploading={(uploading: boolean) => {
                        setUploadingImg((prev) => ({
                          ...prev,
                          logo: uploading,
                        }))
                      }}
                      onCancel={() =>
                        setIsCropperModalOpen((prev) => ({
                          ...prev,
                          logo: false,
                        }))
                      }
                    />
                    <button
                      onClick={() =>
                        setIsCropperModalOpen((prev) => ({
                          ...prev,
                          logo: true,
                        }))
                      }
                      className="mt-4 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2"
                    >
                      <EditOutlined />
                      <span>Edit Logo</span>
                    </button>
                  </Row>
                </Col>
              </Form.Item>
            </Form.Item>

            <Form.Item label="Banner">
              <Form.Item name="organizationBanner" noStyle>
                <Col className="flex flex-col items-center justify-center">
                  <Row className="flex min-h-[300px] items-center">
                    <Image
                      unoptimized
                      width={300}
                      height={300}
                      alt="Organization Banner"
                      src={`/api/v1/organization/${organization?.id}/get_banner/${organization?.bannerUrl}`}
                    />
                  </Row>
                  <Row>
                    <ImageCropperModal
                      isOpen={isCropperModalOpen.banner}
                      circular={false}
                      aspect={1920 / 300}
                      imgName="Organization Banner"
                      postURL={`/api/v1/organization/${organization?.id}/upload_banner`}
                      onUpdateComplete={() => {
                        setTimeout(() => {
                          window.location.reload()
                        }, 1750)
                      }}
                      setUploading={(uploading: boolean) => {
                        setUploadingImg((prev) => ({
                          ...prev,
                          banner: uploading,
                        }))
                      }}
                      onCancel={() =>
                        setIsCropperModalOpen((prev) => ({
                          ...prev,
                          banner: false,
                        }))
                      }
                    />
                    <button
                      onClick={() =>
                        setIsCropperModalOpen((prev) => ({
                          ...prev,
                          banner: true,
                        }))
                      }
                      className="mt-4 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2"
                    >
                      <EditOutlined />
                      <span>Edit Banner</span>
                    </button>
                  </Row>
                </Col>
              </Form.Item>
            </Form.Item>
          </Row>
        </Form>
      </Card>

      <Card title="Semester Management" bordered className="w-full">
        {organizationSemesters && organizationSemesters.length > 0 ? (
          organizationSemesters
            .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
            .map((semester) => (
              <Card.Grid
                key={semester.id}
                className="flex w-[50%] flex-col justify-between gap-2 text-center transition-none"
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
            No semesters added yet. Click the button below to add a new
            semester.
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
            creatingSemester={true}
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

      <Card title="SSO" bordered={true} className="w-full">
        <Form layout="vertical">
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col xs={{ span: 24 }} sm={{ span: 12 }}>
              <Form.Item
                label="Organization SSO URL"
                name="organizationWebsiteUrl"
                tooltip="SSO URL used by organization to authenticate user"
              >
                <Input
                  allowClear={true}
                  defaultValue={organization?.ssoUrl}
                  disabled={true}
                />
              </Form.Item>
            </Col>
            <Col xs={{ span: 24 }} sm={{ span: 12 }}>
              <Form.Item
                label="SSO Authorization"
                name="organizationSSOEnabled"
                tooltip="Whether users use organization's authentication system"
              >
                <Switch
                  disabled={true}
                  defaultChecked={organization?.ssoEnabled}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  ) : (
    <Spin />
  )
}
