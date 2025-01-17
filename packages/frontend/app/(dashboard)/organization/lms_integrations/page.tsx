'use client'

import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Select,
  Table,
  message,
} from 'antd'
import { PenBoxIcon, PlusIcon, TrashIcon } from 'lucide-react'
import {
  LMSCourseIntegrationPartial,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { BaseOptionType } from 'antd/es/select'
import { getErrorMessage } from '@/app/utils/generalUtils'

export default function LMSIntegrationsPage(): ReactElement {
  const { userInfo } = useUserInfo()
  const [lmsIntegrations, setLmsIntegrations] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [focusIntegration, setFocusIntegration] = useState<
    LMSIntegrationPlatform | undefined
  >(undefined)
  const [selectedIntegration, setSelectedIntegration] = useState<
    LMSIntegrationPlatform | undefined
  >(undefined)
  const [baseUrl, setBaseUrl] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [delModalOpen, setDelModalOpen] = useState<boolean>(false)

  const fetchDataAsync = useCallback(async () => {
    const response = await API.lmsIntegration.getOrganizationIntegrations(
      Number(userInfo?.organization?.orgId) ?? -1,
    )
    setLmsIntegrations(response)
  }, [userInfo?.organization?.orgId])

  useEffect(() => {
    fetchDataAsync()
  }, [fetchDataAsync])

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
      Object.keys(mappedLMS).map((key) => {
        return {
          value: key,
          label: <span>{mappedLMS[key]}</span>,
          disabled: lmsIntegrations?.find((i) => i.apiPlatform == key) ?? false,
        }
      }),
    [lmsIntegrations, mappedLMS],
  )

  const modalCleanup = () => {
    setModalOpen(false)
    setFocusIntegration(undefined)
    setSelectedIntegration(undefined)
  }

  const upsertIntegration = (
    operation: string,
    integration?: LMSIntegrationPlatform,
  ) => {
    if (baseUrl == undefined || baseUrl.trim() == '') {
      message.error(`Base URL is required to ${operation} an LMS integration`)
      return
    }
    if (integration == undefined) {
      message.error(
        `A valid integration must be provided to ${operation} an LMS integration`,
      )
      return
    }

    API.lmsIntegration
      .upsertOrganizationIntegration(
        Number(userInfo?.organization?.orgId) ?? -1,
        {
          rootUrl: baseUrl,
          apiPlatform: integration,
        },
      )
      .then((result) => {
        if (result != undefined && result.includes('Success')) {
          message.success(result)
          modalCleanup()
        } else {
          throw new Error(
            `Unknown error occurred, could not ${operation} the LMS integration`,
          )
        }
      })
      .catch((error) => {
        message.error(getErrorMessage(error))
      })
      .finally(() => {
        fetchDataAsync()
      })
  }

  const deleteIntegration = () => {
    if (focusIntegration == undefined) {
      message.error('No integration was specified')
      return
    }

    API.lmsIntegration
      .removeOrganizationIntegration(
        Number(userInfo?.organization?.orgId) ?? -1,
        {
          apiPlatform: focusIntegration,
        },
      )
      .then((result) => {
        if (result != undefined && result.includes('Success')) {
          message.success(result)
          setDelModalOpen(false)
          setFocusIntegration(undefined)
        } else {
          throw new Error(
            `Unknown error occurred, could not delete the LMS integration`,
          )
        }
      })
      .catch((error) => {
        message.error(getErrorMessage(error))
      })
      .finally(() => {
        fetchDataAsync()
      })
  }

  return (
    <Card
      title={'Learning Management Systems'}
      bordered={true}
      style={{ marginTop: 10, marginBottom: 10 }}
    >
      <div className={'flex flex-col items-center gap-2'}>
        <Table
          bordered={true}
          dataSource={lmsIntegrations ?? []}
          pagination={false}
          className={'w-full'}
        >
          <Table.Column title={'Platform'} dataIndex={'apiPlatform'} />
          <Table.Column title={'Base URL'} dataIndex={'rootUrl'} />
          <Table.Column
            title={'Integrations'}
            dataIndex={'courseIntegrations'}
            render={(courses: LMSCourseIntegrationPartial[]) => (
              <Collapse className={'col-span-2'}>
                <Collapse.Panel
                  header={`Connections (${courses.length})`}
                  key={'1'}
                >
                  <Table dataSource={courses}>
                    <Table.Column
                      colSpan={1}
                      title={'Course Name'}
                      render={(courseIntegration) => (
                        <p>{courseIntegration.course.name}</p>
                      )}
                    />
                    <Table.Column
                      colSpan={1}
                      title={'API Course ID'}
                      dataIndex={'apiCourseId'}
                    />
                    <Table.Column
                      colSpan={2}
                      title={'API Key Expiry Date'}
                      render={(courseIntegration) => (
                        <p>
                          {courseIntegration.apiKeyExpiry != undefined
                            ? new Date(
                                courseIntegration.apiKeyExpiry,
                              ).toLocaleDateString()
                            : 'No expiry'}
                        </p>
                      )}
                    />
                  </Table>
                </Collapse.Panel>
              </Collapse>
            )}
          />
          <Table.Column
            colSpan={1}
            title={'Actions'}
            render={(integration: LMSOrganizationIntegrationPartial) => (
              <div className={'grid grid-cols-1 gap-4'}>
                <Button
                  className={
                    'border-helpmeblue text-helpmeblue md:hover:bg-helpmeblue md:hover:border-helpmeblue border-2 bg-white p-4 transition-all md:hover:text-white'
                  }
                  onClick={() => {
                    modalCleanup()
                    setFocusIntegration(integration.apiPlatform)
                    setModalOpen(true)
                  }}
                >
                  Edit <PenBoxIcon />
                </Button>
                <Button
                  className={
                    'border-2 border-red-500 bg-white p-4 text-red-500 transition-all md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-white'
                  }
                  onClick={() => {
                    setFocusIntegration(integration.apiPlatform)
                    setDelModalOpen(true)
                  }}
                >
                  Delete <TrashIcon />
                </Button>
              </div>
            )}
          />
        </Table>
        <div>
          <Button
            className={
              'border-helpmeblue text-helpmeblue md:hover:bg-helpmeblue md:hover:border-helpmeblue border-2 bg-white p-4 transition-all md:hover:text-white'
            }
            onClick={() => {
              modalCleanup()
              setModalOpen(true)
            }}
          >
            Add New Integration <PlusIcon />
          </Button>
        </div>
      </div>
      <Modal
        open={modalOpen}
        onCancel={modalCleanup}
        onOk={() =>
          upsertIntegration(
            focusIntegration != undefined ? 'update' : 'create',
            focusIntegration ?? selectedIntegration,
          )
        }
        title={
          focusIntegration != undefined
            ? 'Update LMS Integration'
            : 'Create LMS Integration'
        }
      >
        <div className={'align-center flex w-full flex-col gap-2'}>
          <Form.Item
            label={'LMS API Platform'}
            name={'apiPlatform'}
            tooltip={'The LMS platform to connect with this organization'}
          >
            {focusIntegration != undefined ? (
              <Input disabled={true} />
            ) : (
              <Select
                options={selectOptions as BaseOptionType[]}
                value={selectedIntegration}
                onSelect={(selection) => setSelectedIntegration(selection)}
              />
            )}
          </Form.Item>
          <Form.Item
            label={'LMS Base URL'}
            name={'rootUrl'}
            tooltip={'The base URL of the LMS API to connect to'}
          >
            <Input
              placeholder={'www.example.com'}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Form.Item>
        </div>
      </Modal>
      <Modal
        title={'Are you sure you want to delete this LMS integration?'}
        open={delModalOpen}
        onOk={() => deleteIntegration()}
        onCancel={() => {
          setFocusIntegration(undefined)
          setDelModalOpen(false)
        }}
        okText={'Delete Integration'}
        okButtonProps={{
          className:
            'bg-white border-2 border-red-500 text-red-500 md:hover:bg-red-500 md:hover:border-red-500 md:hover:text-white transition-all',
        }}
      >
        <p>
          All courses with implementations of this integration will have their
          implementations removed.
        </p>
        <p>
          If this integration is re-created, it will need to be re-implemented
          for each course!
        </p>
      </Modal>
    </Card>
  )
}
