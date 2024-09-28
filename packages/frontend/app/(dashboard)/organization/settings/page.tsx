'use client'

import { EditOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Row,
  Spin,
  Switch,
  Upload,
} from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { ReactElement, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { Organization } from '@/app/typings/organization'
import { organizationApi } from '@/app/api/organizationApi'
import { API } from '@/app/api'
import Image from 'next/image'
import ImageCropperModal from '@/app/(dashboard)/components/ImageCropperModal'

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

  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await organizationApi.getOrganization(
        Number(userInfo?.organization?.orgId) ?? -1,
      )

      setOrganization(response)
      setOrganizationName(response.name)
      setOrganizationDescription(response.description)
      setOrganizationWebsiteUrl(response.websiteUrl)
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

  return organization ? (
    <>
      <Card title="General" bordered={true}>
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

      <Card title="Logo & Banner" bordered={true} className="mt-3">
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
                      aspect={1920 / 1080}
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

      <Card
        title="SSO"
        bordered={true}
        style={{ marginTop: 10, marginBottom: 10 }}
      >
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
    </>
  ) : (
    <Spin />
  )
}
