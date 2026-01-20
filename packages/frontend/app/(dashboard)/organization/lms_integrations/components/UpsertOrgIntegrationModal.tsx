'use client'

import { Form, Input, message, Modal, Select, Switch } from 'antd'
import { BaseOptionType } from 'antd/es/select'
import {
  LMSOrganizationIntegrationPartial,
  UpsertLMSOrganizationParams,
} from '@koh/common'
import { JSX, useState } from 'react'
import { getErrorMessage } from '@/app/utils/generalUtils'

type UpsertOrgIntegrationModalProps = {
  modalOpen: boolean
  handleUpsert: (
    props: UpsertLMSOrganizationParams,
    operation: 'create' | 'update',
    clientSecretEdited: boolean,
  ) => Promise<boolean>
  modalCleanup: () => void
  focusIntegration?: LMSOrganizationIntegrationPartial
  platformOptions: {
    value: string
    label: JSX.Element
    disabled: boolean
  }[]
}

const UpsertOrgIntegrationModal: React.FC<UpsertOrgIntegrationModalProps> = ({
  modalOpen,
  handleUpsert,
  modalCleanup,
  focusIntegration,
  platformOptions,
}) => {
  const [form] = Form.useForm<UpsertLMSOrganizationParams>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [clientSecretEdited, setClientSecretEdited] = useState(false)

  const onFinish = () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    form
      .validateFields()
      .then(async (fields) => {
        const isUpdate = focusIntegration != undefined ? 'update' : 'create'
        const result = await handleUpsert(
          fields,
          focusIntegration != undefined ? 'update' : 'create',
          isUpdate ? clientSecretEdited : true,
        )
        if (result) {
          setClientSecretEdited(false)
          modalCleanup()
        }
      })
      .catch((err) => {
        message.error(getErrorMessage(err))
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  return (
    <Modal
      open={modalOpen}
      onCancel={modalCleanup}
      onOk={onFinish}
      okText={focusIntegration != undefined ? 'Confirm Edits' : 'Create'}
      okButtonProps={{
        loading: isSubmitting,
      }}
      title={
        focusIntegration != undefined
          ? 'Update LMS Integration'
          : 'Create LMS Integration'
      }
      destroyOnHidden={true}
    >
      <Form
        form={form}
        initialValues={{
          ...(focusIntegration != undefined
            ? {
                apiPlatform: focusIntegration.apiPlatform,
                rootUrl: focusIntegration.rootUrl,
                clientId: focusIntegration.clientId,
                secure: focusIntegration.secure,
              }
            : {
                secure: true,
              }),
        }}
        onValuesChange={(changedValues) => {
          if (Object.keys(changedValues).includes('clientSecret')) {
            setClientSecretEdited(true)
          }
        }}
      >
        <div className={'align-center flex w-full flex-col gap-2'}>
          <Form.Item
            name={'apiPlatform'}
            label={'LMS API Platform'}
            tooltip={'The LMS platform to connect with this organization'}
            rules={[
              {
                required: true,
                message: 'Select a platform for the integration',
              },
            ]}
          >
            {focusIntegration != undefined ? (
              <Input disabled={true} />
            ) : (
              <Select options={platformOptions as BaseOptionType[]} />
            )}
          </Form.Item>
          <Form.Item
            name={'rootUrl'}
            label={'LMS Domain'}
            tooltip={
              'The base domain (e.g., example.com) of the LMS API to connect to'
            }
            rules={[
              {
                required: true,
                type: 'string',
                message: 'Enter a base URL for the integration',
              },
            ]}
          >
            <Input placeholder={'www.example.com'} />
          </Form.Item>
          <Form.Item
            name={'secure'}
            label={'HTTPS'}
            tooltip={'Whether the platform uses HTTPS or not'}
            rules={[
              {
                warningOnly: true,
                type: 'boolean',
                validator: (_, value, callback) => {
                  if (value !== true) {
                    return Promise.reject('Failed')
                  }
                  callback()
                },
                message:
                  'The HTTPS protocol is typically desired as it enables secure, encrypted communication.',
              },
            ]}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name={'clientId'}
            label={'Developer Key Client ID'}
            tooltip={
              'The client ID, provided by the LMS, for this tool to retrieve access tokens.'
            }
          >
            <Input placeholder={'100000000000'} />
          </Form.Item>
          <Form.Item
            name={'clientSecret'}
            label={'Developer Key Client Secret'}
            tooltip={
              'The client secret, provided by the LMS, for authorization.'
            }
          >
            <Input.Password
              placeholder={
                focusIntegration != undefined &&
                focusIntegration.hasClientSecret
                  ? '*******************************************'
                  : undefined
              }
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default UpsertOrgIntegrationModal
