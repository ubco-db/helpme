'use client'

import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Collapse,
  List,
  message,
  Modal,
  Table,
  Tooltip,
} from 'antd'
import { PenBoxIcon, PlusIcon, TrashIcon } from 'lucide-react'
import {
  LMSCourseIntegrationPartial,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSToken,
  UpsertLMSOrganizationParams,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import UpsertOrgIntegrationModal from '@/app/(dashboard)/organization/lms_integrations/components/UpsertOrgIntegrationModal'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  KeyOutlined,
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
        const disabled = !!lmsIntegrations?.find((i) => i.apiPlatform == key)
        return {
          value: key,
          label: (
            <Tooltip
              title={disabled ? 'This platform is already in use.' : null}
            >
              <span>{mappedLMS[key]}</span>
            </Tooltip>
          ),
          disabled,
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
    clientSecretEdited: boolean,
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

  const [lmsTokens, setLMSTokens] = useState<LMSToken[]>([])
  const [deletingLMSTokens, setDeletingLMSTokens] = useState<number[]>([])

  useEffect(() => {
    const getLMSTokens = async () => {
      await API.lmsIntegration
        .getOrganizationAccessTokens(userInfo?.organization?.orgId ?? -1)
        .then((tokens) => {
          setLMSTokens(tokens)
        })
        .catch((_) => {})
    }
    getLMSTokens()
  }, [])

  const deleteLMSToken = (tokenId: number) => {
    setDeletingLMSTokens((prev) => [...prev, tokenId])
    API.lmsIntegration
      .deleteAccessToken(tokenId)
      .then((result) => {
        if (result) {
          message.success('Successfully invalidated token!')
          setLMSTokens((prev) => prev.filter((t) => t.id != tokenId))
        } else {
          message.error(
            'An error occurred while invalidating token. Please try again later.',
          )
        }
      })
      .catch((err) => {
        message.error(getErrorMessage(err))
      })
      .finally(() => {
        setDeletingLMSTokens((prev) => prev.filter((v) => v != tokenId))
      })
  }

  return (
    <div className={'flex w-full flex-col gap-8'}>
      <h1>Learning Management System Integrations</h1>
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
                                {courseIntegration.isExpired
                                  ? ' (Expired)'
                                  : ''}
                              </span>
                            ) : (
                              <span className={'font-semibold'}>
                                <WarningOutlined
                                  className={'text-yellow-500'}
                                />{' '}
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
      </Card>
      <Card title={'Access Tokens'} variant="outlined">
        <List
          className="flex flex-col gap-2 p-2"
          bordered
          dataSource={lmsTokens}
          renderItem={(token) => {
            const inUseCount = lmsIntegrations
              .map((v) => v.courseIntegrations)
              .reduce((p, c) => [...p, ...c], [])
              .filter((v) => v.accessTokenId == token.id).length
            return (
              <List.Item
                className={'rounded-lg border-2 border-gray-100 shadow-sm'}
              >
                <div className={'flex w-full items-center justify-between'}>
                  <span className={'w-1/4'}>
                    <KeyOutlined className={'mr-2'} />
                    <span className={'font-semibold'}>
                      {token.platform}
                    </span>{' '}
                    Access Token
                  </span>
                  <span className={'w-1/4'}>
                    Belongs to{' '}
                    <Tooltip title={`Email: ${token.userEmail}`}>
                      <span className={'font-semibold'}>{token.userName}</span>
                    </Tooltip>
                  </span>
                  <span className={'w-1/4'}>
                    {inUseCount > 0 ? (
                      <span>
                        In use in{' '}
                        <span className={'font-semibold'}>
                          {inUseCount} course{inUseCount > 1 ? 's' : ''}
                        </span>
                      </span>
                    ) : (
                      'Not in use'
                    )}
                  </span>
                  <div className={'flex gap-2'}>
                    <Tooltip
                      title={`Invalidates and delete token from HelpMe. Contacts ${token.platform} to invalidate the token on their end.`}
                    >
                      <Button
                        disabled={deletingLMSTokens.some((v) => v == token.id)}
                        onClick={() => deleteLMSToken(token.id)}
                        icon={<DeleteOutlined />}
                        danger
                      />
                    </Tooltip>
                  </div>
                </div>
              </List.Item>
            )
          }}
          pagination={{
            position: 'top',
            showSizeChanger: false,
            pageSizeOptions: [],
            pageSize: 20,
          }}
        />
      </Card>
      {modalOpen && (
        <UpsertOrgIntegrationModal
          modalOpen={modalOpen}
          handleUpsert={upsertIntegration}
          modalCleanup={modalCleanup}
          focusIntegration={focusIntegration}
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
    </div>
  )
}
