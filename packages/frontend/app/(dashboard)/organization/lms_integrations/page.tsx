'use client'

import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Collapse, message, Modal, Table } from 'antd'
import { PenBoxIcon, PlusIcon, TrashIcon } from 'lucide-react'
import {
  LMSCourseIntegrationPartial,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  UpsertLMSOrganizationParams,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import UpsertOrgIntegrationModal from '@/app/(dashboard)/organization/lms_integrations/components/UpsertOrgIntegrationModal'
import {
  CheckCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'

export default function LMSIntegrationsPage(): ReactElement {
  const { userInfo } = useUserInfo()
  const [lmsIntegrations, setLmsIntegrations] = useState<
    LMSOrganizationIntegrationPartial[]
  >([])
  const [focusIntegration, setFocusIntegration] = useState<
    LMSOrganizationIntegrationPartial | undefined
  >(undefined)

  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [delModalOpen, setDelModalOpen] = useState<boolean>(false)

  const [clientSecretEdited, setClientSecretEdited] = useState(false)

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
    Object.keys(LMSIntegrationPlatform)
      .filter(
        (integration) =>
          LMSIntegrationPlatform[integration as LMSIntegrationPlatform] !=
          'None',
      )
      .map(
        (integration: string) =>
          (pairs[integration] =
            LMSIntegrationPlatform[integration as LMSIntegrationPlatform]),
      )
    return pairs
  }, [])

  const platformOptions = useMemo(
    () =>
      Object.keys(mappedLMS).map((key) => {
        return {
          value: key,
          label: <span>{mappedLMS[key]}</span>,
          disabled: !!lmsIntegrations?.find((i) => i.apiPlatform == key),
        }
      }),
    [lmsIntegrations, mappedLMS],
  )

  const modalCleanup = () => {
    setModalOpen(false)
    setFocusIntegration(undefined)
  }

  const upsertIntegration = async (
    fields: UpsertLMSOrganizationParams,
    operation: 'create' | 'update',
  ) => {
    const { apiPlatform, rootUrl, secure, clientId } = fields
    let { clientSecret } = fields

    if (!clientSecretEdited) {
      delete fields.clientSecret
    } else if (clientSecretEdited && !clientSecret) {
      clientSecret = null as any
    }

    return await API.lmsIntegration
      .upsertOrganizationIntegration(
        Number(userInfo?.organization?.orgId) ?? -1,
        {
          apiPlatform,
          rootUrl,
          secure,
          clientId,
          clientSecret,
        },
      )
      .then((result) => {
        if (result != undefined && result.includes('Success')) {
          message.success(result)
          return true
        } else {
          throw new Error(
            `Unknown error occurred, could not ${operation} the LMS integration`,
          )
        }
      })
      .catch((error) => {
        message.error(getErrorMessage(error))
        return false
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
          apiPlatform: focusIntegration.apiPlatform,
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
      variant="outlined"
      style={{ marginTop: 10, marginBottom: 10 }}
    >
      <div className={'flex flex-col items-center gap-2'}>
        <Table
          bordered
          dataSource={lmsIntegrations ?? []}
          pagination={false}
          className={'w-full'}
        >
          <Table.Column title={'Platform'} dataIndex={'apiPlatform'} />
          <Table.Column
            title={'URL'}
            render={(val: LMSOrganizationIntegrationPartial) => (
              <span>
                {val.secure ? 'https' : 'http'}://{val.rootUrl}
              </span>
            )}
          />
          <Table.Column title={'Client ID'} dataIndex={'clientId'} />
          <Table.Column
            title={'Client Secret'}
            dataIndex={'hasClientSecret'}
            render={(val: boolean) => (
              <span
                className={cn(
                  val ? 'text-green-500' : 'text-red-500',
                  'flex gap-2',
                )}
              >
                {val ? <CheckCircleOutlined /> : <StopOutlined />}
                <span>{val ? 'Exists' : 'Not Defined'}</span>
              </span>
            )}
          />
          <Table.Column
            title={'Integrations'}
            dataIndex={'courseIntegrations'}
            render={(courses: LMSCourseIntegrationPartial[]) => (
              <Collapse className={'col-span-2'}>
                <Collapse.Panel
                  header={`Connections (${courses.length})`}
                  key={'1'}
                >
                  <Table
                    dataSource={courses}
                    pagination={{
                      pageSize: 5,
                      pageSizeOptions: [],
                      showSizeChanger: false,
                    }}
                  >
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
                      title={'Auth Method'}
                      render={(
                        courseIntegration: LMSCourseIntegrationPartial,
                      ) => (
                        <p>
                          {courseIntegration.accessTokenId != undefined ? (
                            'Access Token'
                          ) : courseIntegration.hasApiKey ? (
                            <span
                              className={cn(
                                courseIntegration.isExpired
                                  ? 'font-semibold text-red-500'
                                  : '',
                              )}
                            >
                              API Key
                              {courseIntegration.isExpired ? ' (Expired)' : ''}
                            </span>
                          ) : (
                            <span className={'font-semibold'}>
                              <WarningOutlined className={'text-yellow-500'} />{' '}
                              None
                            </span>
                          )}
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
                    setFocusIntegration(integration)
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
                    setFocusIntegration(integration)
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
      {modalOpen && (
        <UpsertOrgIntegrationModal
          modalOpen={modalOpen}
          handleUpsert={upsertIntegration}
          modalCleanup={modalCleanup}
          focusIntegration={focusIntegration}
          setClientSecretEdited={setClientSecretEdited}
          platformOptions={platformOptions}
        />
      )}
      {delModalOpen && (
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
      )}
    </Card>
  )
}
