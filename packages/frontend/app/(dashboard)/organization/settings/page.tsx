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
import { ReactElement, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { Organization } from '@/app/typings/organization'
import { API } from '@/app/api'
import Image from 'next/image'
import ImageCropperModal from '@/app/(dashboard)/components/ImageCropperModal'
import { SemesterPartial } from '@koh/common'

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
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false)

  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await API.organizations.get(
        Number(userInfo?.organization?.orgId) ?? -1,
      )

      setOrganization(response)
      setOrganizationName(response.name)
      setOrganizationDescription(response.description)
      setOrganizationWebsiteUrl(response.websiteUrl)
      setOrganizationSemesters(response.semesters)
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
    return
  }

  const handleEditSemester = (semesterId: number) => {
    {
      const semester = organizationSemesters.find((s) => s.id === semesterId)
      if (!semester) {
        message.error('Semester not found')
        return
      }
      semesterForm.setFieldsValue({
        name: semester.name,
        year: semester.year,
        startMonth: semester.startMonth,
        endMonth: semester.endMonth,
        description: semester.description,
      })
      setIsSemesterModalOpen(true)
    }
  }

  const handleDeleteSemester = (semesterId: number) => {
    return
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

      <Card title="Semester Management" bordered={true} className="w-full">
        <Row gutter={[16, 16]}>
          {organizationSemesters && organizationSemesters.length > 0 ? (
            organizationSemesters.map((semester, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={semester.id}>
                <Card
                  title={semester.name}
                  bordered
                  actions={[
                    <Button
                      type="link"
                      key="edit"
                      onClick={() => handleEditSemester(semester.id)}
                    >
                      Edit
                    </Button>,
                    <Button
                      danger
                      type="link"
                      key="delete"
                      onClick={() => handleDeleteSemester(semester.id)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <p>
                    <strong>Year:</strong> {semester.year}
                  </p>
                  <p>
                    <strong>Start Month:</strong> {semester.startMonth}
                  </p>
                  <p>
                    <strong>End Month:</strong> {semester.endMonth}
                  </p>
                  {semester.description && (
                    <p>
                      <strong>Description:</strong> {semester.description}
                    </p>
                  )}
                </Card>
              </Col>
            ))
          ) : (
            <Col span={24} className="text-center">
              No semesters added yet. Click the button below to add a new
              semester.
            </Col>
          )}

          {/* Add Semester Button */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Button
              type="dashed"
              onClick={() => {
                setIsSemesterModalOpen(true)
              }}
            >
              + Add New Semester
            </Button>
          </Col>
        </Row>

        {/* Semester Modal Placeholder */}
        {isSemesterModalOpen && (
          <Modal
            title="Add New Semester"
            visible={isSemesterModalOpen}
            onCancel={() => setIsSemesterModalOpen(false)}
            onOk={handleAddSemester}
            okText="Save"
            cancelText="Cancel"
          >
            {/* Add your form inputs for semester here */}
            <Form layout="vertical" form={semesterForm}>
              <Form.Item
                label="Semester Name"
                name="name"
                rules={[
                  { required: true, message: 'Please enter the semester name' },
                ]}
              >
                <Input placeholder="e.g., Fall 2024" />
              </Form.Item>

              <Form.Item
                label="Year"
                name="year"
                rules={[{ required: true, message: 'Please select a year' }]}
              >
                <Select placeholder="Select Year">
                  {/* grab all years in a 5 year "radius" to current year */}
                  {Array.from(
                    { length: 10 },
                    (_, i) => new Date().getFullYear() + i - 5,
                  ).map((year) => (
                    <Select.Option key={year} value={year}>
                      {year}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Start Month"
                name="startMonth"
                rules={[
                  { required: true, message: 'Please select a start month' },
                ]}
              >
                <Select placeholder="Select Start Month">
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((month, index) => (
                    <Select.Option key={index + 1} value={index + 1}>
                      {month}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="End Month"
                name="endMonth"
                rules={[
                  { required: true, message: 'Please select an end month' },
                ]}
              >
                <Select placeholder="Select End Month">
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((month, index) => (
                    <Select.Option key={index + 1} value={index + 1}>
                      {month}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Description" name="description">
                <TextArea rows={3} placeholder="Optional description" />
              </Form.Item>
            </Form>
          </Modal>
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
