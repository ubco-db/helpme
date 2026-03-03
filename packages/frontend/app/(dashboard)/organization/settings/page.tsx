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
} from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import Image from 'next/image'
import ImageCropperModal from '@/app/(dashboard)/components/ImageCropperModal'
import {
  GetOrganizationResponse,
  OrganizationRole,
  OrganizationSettingsDefaults,
  SemesterPartial,
} from '@koh/common'
import { SemesterManagement } from './components/SemesterManagement'
import OrganizationSettingSwitch from '@/app/(dashboard)/organization/settings/components/OrganizationSettingSwitch'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { checkCourseCreatePermissions } from '@/app/utils/generalUtils'
import { AllProfInvites } from './components/AllProfInvites'

export default function SettingsPage(): ReactNode {
  // Handler to update SSO patterns
  const updateSSO = async () => {
    try {
      const formValues = await formSSO.validateFields()
      const ssoEmailPatterns = formValues.ssoEmailPatterns || []
      await API.organizations.patch(organization?.id ?? -1, {
        ssoEmailPatterns,
      })
      message.success('SSO patterns updated')
      setOrganization((prev) =>
        prev ? { ...prev, ssoEmailPatterns: ssoEmailPatterns } : prev,
      )
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to update SSO patterns'
      message.error(errorMessage)
    }
  }
  const [formGeneral] = Form.useForm()
  const [formSSO] = Form.useForm()

  const [isCropperModalOpen, setIsCropperModalOpen] = useState<{
    logo: boolean
    banner: boolean
  }>({ logo: false, banner: false })
  const [isUploadingImg, setUploadingImg] = useState<{
    logo: boolean
    banner: boolean
  }>({ logo: false, banner: false })

  const { userInfo, setUserInfo } = useUserInfo()
  const organizationId = useMemo(
    () => Number(userInfo?.organization?.orgId) ?? -1,
    [userInfo?.organization?.orgId],
  )

  const [organization, setOrganization] = useState<GetOrganizationResponse>()
  const [organizationSemesters, setOrganizationSemesters] = useState<
    SemesterPartial[]
  >([])
  const organizationSettings = useOrganizationSettings(organizationId)

  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await API.organizations.get(organizationId)
      const semesters = response.semesters.map((s: SemesterPartial) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate ? new Date(s.startDate) : null,
        endDate: s.endDate ? new Date(s.endDate) : null,
        description: s.description,
        color: s.color,
      }))
      setOrganization({
        ...response,
        semesters,
      })
      setOrganizationSemesters(semesters)

      formGeneral.setFieldsValue({
        organizationName: response.name,
        organizationDescription: response.description,
        organizationWebsiteUrl: response.websiteUrl,
      })
      formSSO.setFieldsValue({
        ssoEmailPatterns: response.ssoEmailPatterns?.length
          ? response.ssoEmailPatterns
          : [''],
      })
    }
    if (organizationId > 0) {
      fetchDataAsync()
    }
  }, [organizationId, formGeneral, formSSO])

  const updateGeneral = async () => {
    const {
      organizationName,
      organizationDescription,
      organizationWebsiteUrl,
    } = await formGeneral.validateFields()

    if (
      organizationName === organization?.name &&
      organizationDescription === organization?.description &&
      organizationWebsiteUrl === organization?.websiteUrl
    ) {
      message.info(
        'Organization was not updated as information has not been changed',
      )
      return
    }

    await API.organizations
      .patch(organization?.id ?? -1, {
        name: organizationName,
        description: organizationDescription,
        websiteUrl: organizationWebsiteUrl,
      })
      .then((_) => {
        message.success('Organization updated')
        setOrganization((prev) =>
          prev
            ? {
                ...prev,
                name: organizationName,
                description: organizationDescription,
                websiteUrl: organizationWebsiteUrl,
              }
            : prev,
        )

        setUserInfo((prev) =>
          prev
            ? {
                ...prev,
                organization: {
                  ...prev.organization,
                  id: prev.organization!.id,
                  orgId: prev.organization!.orgId,
                  organizationName: organizationName,
                  organizationDescription: organizationDescription,
                },
              }
            : prev,
        )
      })

      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  return organization ? (
    <div className="flex flex-col items-center gap-3">
      {userInfo.organization?.organizationRole === OrganizationRole.ADMIN && (
        <>
          <Row className="flex w-full flex-col gap-2 md:flex-row">
            <div className={'min-w-2/3 max-w-full flex-auto'}>
              <Card title="General" variant="outlined" className="w-full">
                <Form
                  form={formGeneral}
                  onFinish={updateGeneral}
                  layout="vertical"
                  initialValues={{
                    organizationName: organization?.name,
                    organizationDescription: organization?.description,
                    organizationWebsiteUrl: organization?.websiteUrl,
                  }}
                >
                  <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                    <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                      <Form.Item
                        label="Organization Name"
                        name="organizationName"
                        tooltip="Name of your organization"
                        rules={[
                          {
                            required: true,
                            message: 'Organization name is required',
                          },
                          {
                            min: 3,
                            message:
                              'Organization name must be at least 3 characters',
                          },
                        ]}
                      >
                        <Input allowClear={true} placeholder="UBC" />
                      </Form.Item>
                    </Col>

                    <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                      <Form.Item
                        label="Organization Website URL"
                        name="organizationWebsiteUrl"
                        tooltip="Website URL of your organization"
                        rules={[
                          {
                            type: 'url',
                            message: 'Please enter a valid URL',
                          },
                        ]}
                      >
                        <Input
                          allowClear={true}
                          placeholder="https://www.ubc.ca/"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="Organization Description"
                    name="organizationDescription"
                    tooltip="Description of your organization. Please keep short otherwise it takes a lot of room on mobile on /courses page"
                    rules={[
                      {
                        min: 10,
                        message:
                          'Organization description must be at least 10 characters',
                      },
                    ]}
                  >
                    <TextArea rows={4} style={{ resize: 'none' }} />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      Update
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </div>
            <div className={'flex-auto'}>
              <Card title="Organization Settings" className={'h-full w-full'}>
                <div className={'flex w-full flex-col'}>
                  <OrganizationSettingSwitch
                    defaultChecked={
                      organizationSettings?.allowProfCourseCreate ??
                      OrganizationSettingsDefaults.allowProfCourseCreate
                    }
                    settingName={'allowProfCourseCreate'}
                    description={
                      'Enables whether organization professors can create courses. Course professors without the organization professor role can never create courses.'
                    }
                    title={'Professors Can Create Courses'}
                    organizationId={organizationId}
                  />
                  <OrganizationSettingSwitch
                    defaultChecked={
                      organizationSettings?.allowLMSApiKey ??
                      OrganizationSettingsDefaults.allowLMSApiKey
                    }
                    settingName={'allowLMSApiKey'}
                    description={
                      'Enables whether LMS integrations are allowed to use API keys. Otherwise, professors will need to use OAuth flow to generate an access token from the platform.'
                    }
                    title={'Allow LMS Integration API Keys'}
                    organizationId={organizationId}
                  />
                </div>
              </Card>
            </div>
          </Row>

          <Card title="Logo & Banner" variant="outlined" className="w-full">
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

          <Card title="SSO" variant="outlined" className="w-full">
            <Form
              form={formSSO}
              layout="vertical"
              initialValues={{
                ...organization,
                ssoEmailPatterns: Array.isArray(organization?.ssoEmailPatterns)
                  ? organization.ssoEmailPatterns.length > 0
                    ? organization.ssoEmailPatterns
                    : ['']
                  : organization?.ssoEmailPatterns
                    ? [organization.ssoEmailPatterns]
                    : [''],
              }}
              onFinish={updateSSO}
            >
              <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                  <Form.Item
                    label="Organization SSO URL"
                    name="organizationWebsiteUrl"
                    tooltip="SSO URL used by organization to authenticate user"
                  >
                    <Input
                      allowClear
                      defaultValue={organization?.ssoUrl}
                      disabled
                    />
                  </Form.Item>
                </Col>
                <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                  <Form.Item
                    label="SSO Authorization"
                    name="organizationSSOEnabled"
                    tooltip="Whether users use organization's authentication system"
                    valuePropName="checked"
                  >
                    <Switch
                      disabled
                      defaultChecked={organization?.ssoEnabled}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {organization?.ssoEnabled && (
                <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                  <Col xs={{ span: 24 }}>
                    <Form.Item label="SSO Email Pattern(s)" colon={false}>
                      <Form.List name="ssoEmailPatterns">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <div
                                key={key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <Form.Item
                                  {...restField}
                                  name={name}
                                  style={{ flex: 1, marginBottom: 0 }}
                                  rules={[
                                    {
                                      required: true,
                                      message: 'Enter a pattern or domain',
                                    },
                                  ]}
                                >
                                  <Input placeholder="e.g. r^.*@ubc\.ca$ or @example.com" />
                                </Form.Item>
                                <Button
                                  type="link"
                                  danger
                                  onClick={() => remove(name)}
                                  style={{ marginLeft: 8 }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}

                            <Button
                              type="dashed"
                              onClick={() => add()}
                              block
                              style={{ marginTop: 8 }}
                            >
                              Add Pattern
                            </Button>
                          </>
                        )}
                      </Form.List>
                    </Form.Item>

                    <Form.Item style={{ marginTop: 12 }}>
                      <Button type="primary" htmlType="submit">
                        Update SSO Patterns
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Form>
          </Card>
        </>
      )}

      {checkCourseCreatePermissions(userInfo, organizationSettings) && (
        <SemesterManagement
          orgId={organization?.id ?? -1}
          organizationSemesters={organizationSemesters}
          setOrganizationSemesters={setOrganizationSemesters}
        />
      )}

      {userInfo.organization?.organizationRole === OrganizationRole.ADMIN && (
        <AllProfInvites orgId={organization.id} />
      )}
    </div>
  ) : (
    <Spin />
  )
}
