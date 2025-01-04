'use client'

import { Button, DatePicker, Form, Input, message, Modal, Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  LMSApiResponseStatus,
  LMSCourseIntegrationPartial,
  LMSIntegration,
  LMSOrganizationIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { BaseOptionType } from 'antd/es/select'
import dayjs from 'dayjs'

type CreateIntegrationModalProps = {
  isOpen: boolean
  setIsOpen: (b: boolean) => void
  courseId: number
  baseIntegration?: LMSCourseIntegrationPartial
  integrationOptions: LMSOrganizationIntegrationPartial[]
  selectedIntegration?: LMSOrganizationIntegrationPartial
  setSelectedIntegration: (
    v: LMSOrganizationIntegrationPartial | undefined,
  ) => void
  isTesting: boolean
  testLMSConnection: (
    key: string,
    course: string,
    platform: LMSIntegration,
  ) => Promise<LMSApiResponseStatus>
  onCreate: () => void
}

const UpsertIntegrationModal: React.FC<CreateIntegrationModalProps> = ({
  isOpen,
  setIsOpen,
  courseId,
  baseIntegration,
  integrationOptions,
  selectedIntegration,
  setSelectedIntegration,
  isTesting,
  testLMSConnection,
  onCreate,
}) => {
  const [apiKey, setApiKey] = useState<string>('')
  const [apiKeyExpiry, setApiKeyExpiry] = useState<Date | undefined>(undefined)
  const [apiCourseId, setApiCourseId] = useState<string>('')
  const [selectedPlatform, setSelectedPlatform] = useState<
    LMSIntegration | undefined
  >(baseIntegration?.apiPlatform)

  const usePlatform = useMemo(() => {
    if (baseIntegration != undefined)
      return selectedPlatform ?? baseIntegration.apiPlatform
    else if (selectedIntegration != undefined)
      return selectedIntegration.apiPlatform
    else return 'None' as LMSIntegration
  }, [baseIntegration, selectedIntegration, selectedPlatform])

  const mappedLMS = useMemo(() => {
    const pairs: { [key: string]: string } = {}
    Object.keys(LMSIntegration).map((integration: string) => {
      pairs[integration] = LMSIntegration[integration as LMSIntegration]
    })
    return pairs
  }, [])

  const selectOptions = useMemo(
    () =>
      Object.keys(mappedLMS).map((key) => {
        return {
          value: key,
          label: <span>{mappedLMS[key]}</span>,
          disabled: integrationOptions.find((i) => i.apiPlatform == key),
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

    testLMSConnection(apiKey, apiCourseId, usePlatform).then((result) => {
      if (result == LMSApiResponseStatus.Success) {
        const body: { [key: string]: any } = {
          apiPlatform: usePlatform,
          apiKey,
          apiKeyExpiry,
          apiCourseId,
        }
        if (baseIntegration != undefined) {
          body['apiKeyExpiryDeleted'] = apiKeyExpiry == undefined
        }

        API.course
          .upsertIntegration(courseId, body as any)
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
          .finally(() => {
            onCreate()
          })
      }
    })
  }

  useEffect(() => {
    if (baseIntegration != undefined) {
      setApiKeyExpiry(baseIntegration.apiKeyExpiry)
      setApiCourseId(baseIntegration.apiCourseId)
    }
  }, [baseIntegration])

  const modalCleanup = () => {
    setIsOpen(false)
  }

  return (
    <Modal
      title={
        baseIntegration != undefined
          ? 'Update LMS Integration'
          : 'Create LMS Integration'
      }
      open={isOpen}
      okText={baseIntegration == undefined ? 'Create' : 'Update'}
      onOk={() => upsertCourseIntegration()}
      onCancel={modalCleanup}
    >
      {selectedIntegration != undefined && (
        <>
          <Form.Item
            label={'LMS Platform'}
            tooltip={'The API platform to connect with'}
          >
            <Select
              options={selectOptions as BaseOptionType[]}
              value={selectedPlatform ?? selectedIntegration?.apiPlatform}
              onSelect={(selection) => {
                setSelectedPlatform(selection)
                setSelectedIntegration(
                  integrationOptions.find((i) => i.apiPlatform == selection),
                )
              }}
              disabled={baseIntegration == undefined}
            />
          </Form.Item>
          <Form.Item
            label={'LMS Base URL'}
            tooltip={'The base URL of the LMS API to connect to'}
          >
            <Input value={selectedIntegration.rootUrl} disabled={true} />
          </Form.Item>
          <Form.Item
            label={'API Key'}
            tooltip={'The API key to access the LMS with'}
          >
            <Input.Password
              placeholder={
                baseIntegration != undefined
                  ? '*******************************************'
                  : undefined
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label={'API Key Expiry (Optional)'}
            tooltip={'The expiry date (if any) for the API key'}
          >
            <DatePicker
              allowClear={true}
              defaultValue={
                baseIntegration?.apiKeyExpiry != undefined
                  ? dayjs(baseIntegration.apiKeyExpiry)
                  : undefined
              }
              onChange={(_, dateString) =>
                dateString != undefined && dateString != ''
                  ? setApiKeyExpiry(new Date(dateString as string))
                  : setApiKeyExpiry(undefined)
              }
            />
          </Form.Item>
          <Form.Item
            label={'API Course ID'}
            tooltip={'The identifier for the course on the LMS to link with'}
          >
            <Input
              value={apiCourseId}
              onChange={(e) => setApiCourseId(e.target.value)}
            />
          </Form.Item>
          <div className={'flex flex-row justify-center'}>
            <Button
              onClick={() =>
                testLMSConnection(apiKey, apiCourseId, usePlatform)
              }
              loading={isTesting}
            >
              Test API Connection
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default UpsertIntegrationModal
