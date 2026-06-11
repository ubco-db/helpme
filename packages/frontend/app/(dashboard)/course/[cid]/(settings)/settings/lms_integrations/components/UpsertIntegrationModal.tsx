'use client'

import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Select,
  Tabs,
  Tooltip,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  LMSApiResponseStatus,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSToken,
  OrganizationSettingsResponse,
  Role,
  UpsertLMSCourseParams,
  User,
} from '@koh/common'
import { API } from '@/app/api'
import { BaseOptionType } from 'antd/es/select'
import dayjs, { Dayjs } from 'dayjs'
import { useRouter } from 'next/navigation'
import { DeleteOutlined } from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'

type CreateIntegrationModalProps = {
  isOpen: boolean
  setIsOpen: (b: boolean) => void
  organizationSettings: OrganizationSettingsResponse
  courseId: number
  baseIntegration?: LMSCourseIntegrationPartial
  integrationOptions: LMSOrganizationIntegrationPartial[]
  selectedIntegration?: LMSOrganizationIntegrationPartial
  setSelectedIntegration: (
    v: LMSOrganizationIntegrationPartial | undefined,
  ) => void
  isTesting: boolean
  testLMSConnection: (
    course: string,
    platform: LMSIntegrationPlatform,
    key?: string,
    id?: number,
  ) => Promise<LMSApiResponseStatus>
  onCreate: () => void
  lockApiCourseId?: string
  lti?: boolean
  onTokenGenerate?: () => void
}

const UpsertIntegrationModal: React.FC<CreateIntegrationModalProps> = ({
  isOpen,
  setIsOpen,
  organizationSettings,
  courseId,
  baseIntegration,
  integrationOptions,
  selectedIntegration,
  setSelectedIntegration,
  isTesting,
  testLMSConnection,
  onCreate,
  lockApiCourseId,
  lti,
  onTokenGenerate,
}) => {
  const { userInfo } = useUserInfo()

  const router = useRouter()
  const [form] = Form.useForm<UpsertLMSCourseParams>()
  const [formValues, setFormValues] = useState<UpsertLMSCourseParams>({} as any)

  const [accessTokens, setAccessTokens] = useState<LMSToken[]>([])
  const [availableCourses, setAvailableCourses] = useState<
    LMSCourseAPIResponse[] | undefined
  >(undefined)
  const [activeTab, setActiveTab] = useState<'api_key' | 'access_token'>(
    'access_token',
  )

  const [apiKeyEdited, setApiKeyEdited] = useState(false)

  const [canGenerate, setCanGenerate] = useState(false)
  useEffect(() => {
    ;(async () => {
      if (selectedIntegration) {
        await API.lmsIntegration
          .canGenerate(selectedIntegration.apiPlatform)
          .then((res) => {
            setCanGenerate(res)
          })
          .catch(() => setCanGenerate(false))
      }
    })()
  }, [selectedIntegration])

  const getAccessTokens = async () => {
    await API.lmsIntegration
      .getAccessTokens(
        selectedIntegration?.apiPlatform ?? baseIntegration?.apiPlatform,
      )
      .then((res) => {
        setAccessTokens(res ?? [])
        if (
          formValues['accessTokenId'] == undefined &&
          Array.isArray(res) &&
          res.length > 0
        ) {
          form.setFieldsValue({
            accessTokenId: res[0].id,
          })
          setFormValues((prev) => ({
            ...prev,
            accessTokenId: res[0].id,
          }))
        }
      })
  }

  useEffect(() => {
    getAccessTokens()
  }, [selectedIntegration?.apiPlatform, baseIntegration?.apiPlatform])

  useEffect(() => {
    const getUserCourses = async () => {
      if (!formValues.accessTokenId) return
      await API.lmsIntegration
        .getUserCourses(formValues.accessTokenId)
        .then((res) => {
          setAvailableCourses(res ?? [])
          if (
            Array.isArray(res) &&
            !res.find((v) => String(v.id) == formValues.apiCourseId)
          ) {
            form.setFieldsValue({
              apiCourseId: res[0]?.id as any,
            })
          }
        })
    }
    getUserCourses()
  }, [form, formValues.accessTokenId])

  const mappedLMS = useMemo(() => {
    const pairs: { [key: string]: string } = {}
    Object.keys(LMSIntegrationPlatform).map((integration: string) => {
      pairs[integration] =
        LMSIntegrationPlatform[integration as LMSIntegrationPlatform]
    })
    return pairs
  }, [])

  const selectOptions = useMemo(
    () =>
      Object.keys(mappedLMS)
        .filter((k) => k != 'None')
        .map((key) => {
          return {
            title: key,
            value: key,
            label: <span>{mappedLMS[key]}</span>,
            disabled: !!integrationOptions.find((i) => i.apiPlatform == key),
          }
        }),
    [integrationOptions, mappedLMS],
  )

  const upsertCourseIntegration = () => {
    if (selectedIntegration == undefined) {
      message.error(
        `An organization LMS configuration must be provided to link an LMS integration`,
      )
      return
    }

    form.validateFields().then((fields) => {
      fields.apiKeyExpiry =
        (fields.apiKeyExpiry as unknown as Dayjs | undefined)?.toDate() ??
        (null as any)
      const {
        apiKey,
        apiKeyExpiry,
        accessTokenId,
        apiCourseId,
      }: UpsertLMSCourseParams = fields

      testLMSConnection(
        apiCourseId!,
        selectedIntegration.apiPlatform,
        activeTab == 'api_key' && organizationSettings.allowLMSApiKey
          ? apiKey
          : undefined,
        activeTab == 'access_token' || !organizationSettings.allowLMSApiKey
          ? accessTokenId
          : undefined,
      ).then(async (result) => {
        if (result == LMSApiResponseStatus.Success) {
          const body: UpsertLMSCourseParams = {
            apiPlatform: selectedIntegration.apiPlatform,
            apiKey,
            apiKeyExpiry,
            accessTokenId,
            apiCourseId,
          }

          if (activeTab == 'api_key' && organizationSettings.allowLMSApiKey) {
            delete body.accessTokenId
          } else {
            delete body.apiKey
            delete body.apiKeyExpiry
          }

          if (!apiKeyEdited) {
            delete body.apiKey
            delete body.apiKeyExpiry
          }

          if (baseIntegration != undefined) {
            body.apiKeyExpiryDeleted =
              baseIntegration.apiKeyExpiry != undefined &&
              apiKeyExpiry == undefined
          }

          await API.lmsIntegration
            .upsertCourseIntegration(courseId, body)
            .then((result) => {
              if (!result) {
                message.error(
                  `Unknown error occurred, could not link the LMS integration`,
                )
              } else if (result.includes('Success')) {
                message.success(result)
                modalCleanup()
              } else {
                message.error(result)
              }
            })
            .catch((err) => {
              message.error(getErrorMessage(err))
            })
            .finally(() => {
              onCreate()
            })
        }
      })
    })
  }

  const modalCleanup = () => {
    setIsOpen(false)
  }

  const handleGenerate = () => {
    const url = API.lmsIntegration.redirectAuthUrl(
      selectedIntegration?.apiPlatform ?? baseIntegration?.apiPlatform,
      courseId,
      lti,
    )

    if (onTokenGenerate) {
      onTokenGenerate()
    }

    if (lti) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      router.push(url)
    }
  }

  const handleInvalidate = async () => {
    if (!formValues['accessTokenId']) {
      message.warning('No access token selected')
      return
    }
    API.lmsIntegration
      .deleteAccessToken(formValues['accessTokenId'])
      .then((res) => {
        if (res) {
          message.success('Successfully invalidated token!')
          // Just to make sure the warning doesn't show if unnecessary
          if (
            baseIntegration &&
            baseIntegration.accessTokenId == formValues['accessTokenId']
          ) {
            baseIntegration.accessTokenId = undefined
          }
        } else {
          message.error('Failed to invalidate access token.')
        }
      })
      .catch((err) => {
        message.error(getErrorMessage(err))
      })
      .finally(() => {
        getAccessTokens()
      })
  }

  useEffect(() => {
    if (baseIntegration) {
      setSelectedIntegration(
        integrationOptions.find(
          (v) => v.apiPlatform == baseIntegration.apiPlatform,
        ),
      )
    }
  }, [baseIntegration, integrationOptions])

  return (
    <Modal
      title={
        lti
          ? 'LMS Integration'
          : baseIntegration != undefined
            ? 'Update LMS Integration'
            : 'Create LMS Integration'
      }
      open={isOpen}
      okText={
        lti ? 'Confirm' : baseIntegration == undefined ? 'Create' : 'Update'
      }
      onOk={() => upsertCourseIntegration()}
      onCancel={modalCleanup}
    >
      {selectedIntegration != undefined && (
        <Form
          form={form}
          initialValues={{
            ...(baseIntegration != undefined
              ? {
                  accessTokenId: baseIntegration.accessTokenId,
                  apiCourseId: baseIntegration.apiCourseId,
                  apiKeyExpiry:
                    baseIntegration.apiKeyExpiry != undefined
                      ? dayjs(baseIntegration.apiKeyExpiry)
                      : undefined,
                }
              : {
                  apiCourseId: lockApiCourseId,
                }),
          }}
          onValuesChange={(changedValues) => {
            if (Object.keys(changedValues).includes('apiKey')) {
              setApiKeyEdited(true)
            }
          }}
        >
          <Divider>Integration Platform</Divider>
          <Form.Item
            label={'LMS Platform'}
            tooltip={'The API platform to connect with'}
          >
            <Select
              value={selectedIntegration?.apiPlatform}
              options={selectOptions as BaseOptionType[]}
              disabled={baseIntegration == undefined}
              onSelect={(v) =>
                setSelectedIntegration(
                  integrationOptions.find((o) => o.apiPlatform == v),
                )
              }
            />
          </Form.Item>
          <Form.Item label={'LMS Base URL'}>
            <Input value={selectedIntegration.rootUrl} disabled={true} />
          </Form.Item>
          <Divider>Authorization Method</Divider>
          {baseIntegration != undefined &&
            baseIntegration.accessTokenId != undefined &&
            !accessTokens.some(
              (v) => v.id == baseIntegration.accessTokenId,
            ) && (
              <Alert
                className={'my-2'}
                type={'warning'}
                showIcon
                message={
                  <span className={'font-semibold'}>
                    Warning: Access Token Found
                  </span>
                }
                description={`This integration already has an access token attached, but it does not belong to you. Be careful as updating the integration with a new token ${organizationSettings.allowLMSApiKey ? 'or a new API key' : ''} will overwrite the other user's configuration.`}
              />
            )}
          {organizationSettings.allowLMSApiKey ? (
            <Tabs
              destroyOnHidden={true}
              activeKey={activeTab}
              onTabClick={(key) => setActiveTab(key as any)}
              items={[
                {
                  key: 'access_token',
                  label: 'Access Token',
                  children: (
                    <AccessTokenFormItem
                      accessTokens={accessTokens}
                      handleGenerate={handleGenerate}
                      handleInvalidate={handleInvalidate}
                      userInfo={userInfo}
                      canGenerate={canGenerate}
                      courseId={courseId}
                    />
                  ),
                },
                {
                  key: 'api_key',
                  label: 'API Key',
                  children: (
                    <ApiKeyFormItem baseIntegration={baseIntegration} />
                  ),
                },
              ]}
            />
          ) : (
            <AccessTokenFormItem
              accessTokens={accessTokens}
              handleGenerate={handleGenerate}
              handleInvalidate={handleInvalidate}
              userInfo={userInfo}
              canGenerate={canGenerate}
              courseId={courseId}
            />
          )}
          <Divider>Course Information</Divider>
          <Form.Item
            name={'apiCourseId'}
            label={
              availableCourses && availableCourses.length > 0
                ? 'API Course'
                : 'API Course ID'
            }
            tooltip={`The ${!availableCourses || availableCourses.length <= 0 ? 'identifier for the' : ''} course on the LMS platform to link with.`}
            rules={[
              {
                required: true,
                message: 'Enter a course from the platform to link with.',
              },
            ]}
          >
            {availableCourses && availableCourses.length > 0 ? (
              <Select disabled={lockApiCourseId != undefined}>
                {availableCourses.map((v, i) => (
                  <Select.Option value={v.id} key={`course-${i}`}>
                    {v.name}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <Input
                disabled={availableCourses && availableCourses.length == 0}
              />
            )}
          </Form.Item>
          {availableCourses && availableCourses.length == 0 && (
            <div
              className={
                'rounded-md border-2 border-red-500 bg-red-100 p-2 text-red-500'
              }
            >
              You have no courses on this LMS. You cannot create an LMS
              integration.
            </div>
          )}
          <div className={'flex flex-row justify-center'}>
            <Button
              onClick={() =>
                form
                  .validateFields()
                  .then((fields) => {
                    if (!selectedIntegration)
                      throw new Error('No platform selected')
                    return testLMSConnection(
                      fields.apiCourseId!,
                      selectedIntegration.apiPlatform,
                      activeTab == 'api_key' &&
                        organizationSettings.allowLMSApiKey
                        ? fields.apiKey
                        : undefined,
                      activeTab == 'access_token'
                        ? fields.accessTokenId
                        : undefined,
                    )
                  })
                  .catch(() => {})
              }
              loading={isTesting}
            >
              Test API Connection
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  )
}

export default UpsertIntegrationModal

const ApiKeyFormItem: React.FC<{
  baseIntegration?: LMSCourseIntegrationPartial
}> = ({ baseIntegration }) => {
  return (
    <>
      <Form.Item
        name={'apiKey'}
        label={'API Key'}
        tooltip={'The API key to access the LMS with'}
        rules={[
          {
            required: true,
            message: 'Provide an API key to use for the integration.',
          },
        ]}
      >
        <Input.Password
          placeholder={
            baseIntegration != undefined && baseIntegration.hasApiKey
              ? '*******************************************'
              : undefined
          }
        />
      </Form.Item>
      <Form.Item
        name={'apiKeyExpiry'}
        label={'API Key Expiry (Optional)'}
        tooltip={'The expiry date (if any) for the API key'}
      >
        <DatePicker allowClear={true} />
      </Form.Item>
    </>
  )
}

const AccessTokenFormItem: React.FC<{
  accessTokens: LMSToken[]
  handleGenerate: () => void
  handleInvalidate: () => Promise<void>
  userInfo: User
  canGenerate: boolean
  courseId: number
}> = ({
  accessTokens,
  handleGenerate,
  handleInvalidate,
  userInfo,
  canGenerate,
  courseId,
}) => {
  const hasValidRole = [Role.PROFESSOR, Role.TA].includes(
    userInfo.courses?.find((c) => c.course.id === courseId)?.role ??
      Role.STUDENT,
  )

  if (!canGenerate) {
    return (
      <Alert
        className={'my-2'}
        type={'error'}
        showIcon
        message={
          <span className={'font-semibold'}>Cannot Generate Access Tokens</span>
        }
        description={`Cannot generate an access token, your organization has not defined a client ID and/or a client secret for this platform.`}
      />
    )
  }

  if (accessTokens.length <= 0) {
    return (
      <div className={'my-2 flex flex-col items-center gap-2'}>
        <p>You have not generated any access tokens to use with HelpMe.</p>
        <Tooltip
          title={
            !hasValidRole
              ? 'You do not have adequate permissions to generate an access token. Contact an organization administrator for more information.'
              : undefined
          }
        >
          <Button
            className={'w-min'}
            onClick={handleGenerate}
            disabled={!hasValidRole}
          >
            Generate a new Access Token
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={'flex flex-row justify-between gap-1'}>
      <Form.Item
        name={'accessTokenId'}
        label={'Access Token'}
        tooltip={'The access token to access the LMS with'}
        rules={[{ required: true, message: 'Select an access token to use.' }]}
        className={'w-full'}
      >
        <Select>
          {accessTokens.map((v, i) => (
            <Select.Option key={i} value={v.id}>
              {v.platform} Token
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Tooltip title={'Remove this access token'}>
        <Button
          icon={<DeleteOutlined />}
          danger
          onClick={async (evt) => {
            evt.stopPropagation()
            await handleInvalidate()
          }}
        />
      </Tooltip>
    </div>
  )
}
