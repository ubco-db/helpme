import {
  AuthMethodEnum,
  CreateLtiPlatform,
  LtiAuthConfig,
  LtiPlatform,
  UpdateLtiPlatform,
} from '@koh/common'
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Tooltip,
} from 'antd'
import { InfoCircleOutlined, UndoOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'

type UpsertLtiPlatformModalProps = {
  focus?: LtiPlatform
  setFocus: React.Dispatch<React.SetStateAction<LtiPlatform | undefined>>
  isCreating: boolean
  setIsCreating: React.Dispatch<React.SetStateAction<boolean>>
  onCreate: (params: CreateLtiPlatform) => Promise<boolean>
  onUpdate: (id: string, params: UpdateLtiPlatform) => Promise<boolean>
}

const UpsertLtiPlatformModal: React.FC<UpsertLtiPlatformModalProps> = ({
  focus,
  setFocus,
  isCreating,
  setIsCreating,
  onCreate,
  onUpdate,
}) => {
  const [isKeyModified, setIsKeyModified] = useState(false)
  const [methodValue, setMethodValue] = useState<AuthMethodEnum>(
    AuthMethodEnum.JWK_SET,
  )

  const [createForm] = Form.useForm<CreateLtiPlatform>()
  const [updateForm] = Form.useForm<UpdateLtiPlatform>()

  useEffect(() => {
    if (focus != undefined) {
      const method = focus.authToken.method as AuthMethodEnum
      setMethodValue(method)
      updateForm.setFieldValue(['authToken', 'method'], method)
    }
  }, [focus, isCreating, updateForm])

  const watchedUpdateToken = Form.useWatch('accessTokenEndpoint', updateForm)
  const watchedCreateMethod = Form.useWatch('authToken', createForm)
  const watchedUpdateMethod = Form.useWatch('authToken', updateForm)

  const onWatchMethodChange = (watchValue: LtiAuthConfig) => {
    setMethodValue(watchValue?.method)
  }

  const onWatchTokenChange = (watchValue: string) => {
    setIsKeyModified(!!watchValue)
  }

  useEffect(() => {
    onWatchTokenChange(watchedUpdateToken as any)
  }, [watchedUpdateToken])

  useEffect(() => {
    onWatchMethodChange(watchedCreateMethod)
  }, [watchedCreateMethod])

  useEffect(() => {
    onWatchMethodChange(watchedUpdateMethod as any)
  }, [watchedUpdateMethod])

  const cleanup = () => {
    setFocus(undefined)
    setIsCreating(false)
  }

  const onFinish = () => {
    ;(focus != undefined ? updateForm : createForm)
      .validateFields()
      .then(async (values) => {
        if (focus != undefined && !isKeyModified) {
          delete values.authToken?.key
        }
        let success: boolean
        if (focus != undefined) {
          success = await onUpdate(focus.kid, values)
        } else {
          success = await onCreate(values as CreateLtiPlatform)
        }
        if (success) {
          cleanup()
        }
      })
      .catch((err) => {
        message.error(err)
      })
  }

  return (
    <Modal
      title={
        focus != undefined ? 'Editing LTI Platform' : 'Create LTI Platform'
      }
      onCancel={cleanup}
      open={focus != undefined || isCreating}
      destroyOnHidden={true}
      okText={focus != undefined ? 'Confirm Edits' : 'Create Platform'}
      onOk={onFinish}
    >
      {focus != undefined && (
        <Form form={updateForm} initialValues={focus}>
          <FormFields
            methodValue={methodValue}
            isKeyModified={isKeyModified}
            resetKey={() => {
              updateForm.resetFields([['authToken', 'key']])
            }}
          />
        </Form>
      )}
      {isCreating && (
        <Form
          form={createForm}
          initialValues={{
            authToken: {
              method: AuthMethodEnum.JWK_SET,
            },
            active: true,
          }}
        >
          <FormFields methodValue={methodValue} />
        </Form>
      )}
    </Modal>
  )
}

export default UpsertLtiPlatformModal

const FormFields: React.FC<{
  methodValue?: AuthMethodEnum
  isKeyModified?: boolean
  resetKey?: () => void
}> = ({ methodValue, isKeyModified, resetKey }) => {
  return (
    <>
      <Form.Item
        name={'platformUrl'}
        label={
          <Tooltip title="The URL which identifies the platform.">
            Platform URL <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[{ required: true, message: 'Please input the platform URL' }]}
      >
        <Input placeholder={'https://instructure.canvas.com/'} />
      </Form.Item>
      <Form.Item
        name={'clientId'}
        label={
          <Tooltip title="The unique identifier that the platform uses to identify the tool. Also used to partially identify the tool depending on the platform URL.">
            Tool Identifier <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please input the tool ID from the platform',
          },
        ]}
      >
        <Input placeholder={'1234567890'} />
      </Form.Item>
      <Form.Item
        name={'name'}
        label={
          <Tooltip title="A nickname for the configuration.">
            Nickname <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please input the nickname for the platform',
          },
        ]}
      >
        <Input placeholder={'LTI Platform Configuration'} />
      </Form.Item>
      <Form.Item
        name={'authenticationEndpoint'}
        label={
          <Tooltip title="The endpoint used for authentication (login) requests when the platform launches.">
            Authentication Endpoint <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please input the authentication endpoint',
          },
          {
            pattern: /(http|https):\/\//,
            message: 'Please ensure the endpoint is a valid URL',
          },
        ]}
      >
        <Input placeholder={'https://instructure.canvas.com/authentication'} />
      </Form.Item>
      <Form.Item
        name={'accessTokenEndpoint'}
        label={
          <Tooltip title="The endpoint where the platform's public access tokens can be found and scoped access tokens can be requested.">
            Access Token Endpoint <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please input the keys endpoint',
          },
          {
            pattern: /(http|https):\/\//,
            message: 'Please ensure the endpoint is a valid URL',
          },
        ]}
      >
        <Input placeholder={'https://instructure.canvas.com/jwks'} />
      </Form.Item>
      <Form.Item
        name={'authorizationServer'}
        label={
          <Tooltip title="An endpoint used as the 'subject' claim in the JWT token sent to the platform when requesting a scoped access token.">
            Authorization Server <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: false,
          },
        ]}
      >
        <Input placeholder={'https://instructure.canvas.com/authorization'} />
      </Form.Item>
      <Form.Item
        name={['authToken', 'method']}
        label={
          <Tooltip title="The method which is used for authentication with the platform.">
            Authentication Method <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please select the authentication method for the platform',
          },
        ]}
      >
        <Select>
          {Object.keys(AuthMethodEnum).map((key: string) => (
            <Select.Option
              value={
                (AuthMethodEnum as Record<string, any>)[
                  key
                ] as unknown as AuthMethodEnum
              }
              key={key as string}
            >
              {(AuthMethodEnum as Record<string, any>)[key]}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      {methodValue == AuthMethodEnum.JWK_SET ? (
        <Form.Item
          name={['authToken', 'key']}
          label={
            <Tooltip
              title={
                'The endpoint used for retrieving keys for authenticating requests.'
              }
            >
              Authentication URL <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[
            {
              required: true,
              message: 'Please input the authentication key source',
            },
            {
              pattern: /(http|https):\/\//,
              message: 'Please ensure the endpoint is a valid URL',
            },
          ]}
        >
          <Input />
        </Form.Item>
      ) : (
        <Form.Item
          name={['authToken', 'key']}
          label={
            <Tooltip
              title={
                'Depending on the method, the JWK/RSA key used for authenticating requests.'
              }
            >
              Authentication Key <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[
            {
              required: true,
              message: 'Please input the authentication key source',
            },
          ]}
        >
          {methodValue == AuthMethodEnum.RSA_KEY ? (
            <Input.TextArea
              placeholder={'RSA Key'}
              autoSize={{
                minRows: 3,
                maxRows: 10,
              }}
            />
          ) : methodValue == AuthMethodEnum.JWK_KEY ? (
            <Input.TextArea
              placeholder={'JSON Web Key'}
              autoSize={{
                minRows: 3,
                maxRows: 9,
              }}
            />
          ) : null}
          {isKeyModified && (
            <Button icon={<UndoOutlined />} onClick={resetKey} />
          )}
        </Form.Item>
      )}
      <Form.Item
        name={'active'}
        label={
          <Tooltip title="Toggles whether requests for the platform will be actively processed.">
            Active <InfoCircleOutlined />
          </Tooltip>
        }
        rules={[
          {
            required: true,
            message: 'Please select whether the platform will be active or not',
          },
        ]}
      >
        <Switch />
      </Form.Item>
    </>
  )
}
