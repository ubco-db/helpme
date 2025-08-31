'use client'

import { CreateLtiPlatform, LtiPlatform, UpdateLtiPlatform } from '@koh/common'
import { ReactElement, useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import {
  Button,
  Input,
  message,
  Pagination,
  Popconfirm,
  Table,
  Tooltip,
} from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import UpsertLtiPlatformModal from '@/app/admin/lti/components/UpsertLtiPlatformModal'

export default function LtiAdminPage(): ReactElement {
  const [ltiPlatforms, setLtiPlatforms] = useState<LtiPlatform[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [focus, setFocus] = useState<LtiPlatform>()
  const [search, setSearch] = useState<string>()
  const [page, setPage] = useState(1)

  useEffect(() => {
    const getData = async () => {
      await API.lti.admin
        .getPlatforms()
        .then((platforms) => {
          setLtiPlatforms(platforms)
        })
        .catch((err) => {
          message.error(
            `Failed to retrieve LTI platforms: ${getErrorMessage(err)}`,
          )
        })
    }
    getData()
  }, [])

  const createLtiPlatform = async (params: CreateLtiPlatform) => {
    return await API.lti.admin
      .createPlatform(params)
      .then((platform) => {
        setLtiPlatforms((prev) => [...prev, platform])
        return true
      })
      .catch((err) => {
        message.error(`Failed to create LTI platform: ${getErrorMessage(err)}`)
        return false
      })
  }

  const updateLtiPlatform = async (id: string, params: UpdateLtiPlatform) => {
    return await API.lti.admin
      .updatePlatform(id, params)
      .then((platform) => {
        const idxOf = ltiPlatforms.findIndex((p) => p.kid == id)
        if (idxOf >= 0) {
          setLtiPlatforms((prev) => [
            ...prev.slice(0, idxOf),
            platform,
            ...prev.slice(idxOf + 1),
          ])
        }
        return true
      })
      .catch((err) => {
        message.error(`Failed to update LTI platform: ${getErrorMessage(err)}`)
        return false
      })
  }

  const deleteLtiPlatform = async (id: string) => {
    return await API.lti.admin
      .deletePlatform(id)
      .then(() => {
        setLtiPlatforms((prev) => prev.filter((p) => p.kid != id))
        return true
      })
      .catch((err) => {
        message.error(`Failed to delete LTI platform: ${getErrorMessage(err)}`)
        return false
      })
  }

  const matchingPlatforms = useMemo(
    () =>
      search
        ? ltiPlatforms.filter(
            (p) =>
              p.platformUrl.toLowerCase().includes(search.toLowerCase()) ||
              p.clientId.toLowerCase().includes(search.toLowerCase()) ||
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.kid.toLowerCase().includes(search.toLowerCase()),
          )
        : ltiPlatforms,
    [ltiPlatforms, search],
  )

  const paginatedPlatforms = useMemo(
    () => matchingPlatforms.slice((page - 1) * 20, page * 20),
    [matchingPlatforms, page],
  )

  const columns: any[] = [
    {
      dataIndex: 'kid',
      title: 'ID',
      render: (id: string, record: LtiPlatform, index: number) => (
        <div key={`kid-${index}`} className={'w-min'}>
          <div className={'mr-1 truncate'}>{id}</div>
          {record.active ? (
            <Tooltip title={'This platform is active.'}>
              <CheckCircleOutlined className={'text-green-500'} />
            </Tooltip>
          ) : (
            <Tooltip title={'This platform is inactive.'}>
              <PauseCircleOutlined className={'text-gray-300'} />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      dataIndex: 'platformUrl',
      title: 'URL',
    },
    {
      dataIndex: 'clientId',
      title: 'Tool ID',
    },
    {
      dataIndex: 'name',
      title: 'Nickname',
    },
    {
      dataIndex: 'actions',
      title: 'Actions',
      render: (_: any, record: LtiPlatform, index: number) => (
        <div key={`actions-${index}`} className={'flex flex-col gap-1'}>
          <Button
            icon={<EditOutlined />}
            onClick={() => setFocus(record)}
            type={'primary'}
          >
            Edit
          </Button>
          <Popconfirm
            classNames={{
              body: 'w-60',
            }}
            title={'Are you sure you want to delete this platform?'}
            description={
              'It will no longer be recognized, and future LTI launches using its configuration will fail.'
            }
            onConfirm={() => deleteLtiPlatform(record.kid)}
          >
            <Button icon={<DeleteOutlined />} danger type={'primary'}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]
  return (
    <>
      <div className={'flex w-full flex-grow flex-col gap-4'}>
        <h1>LTI Platforms</h1>
        <div className={'flex items-center gap-2'}>
          <Input
            className={'w-full'}
            placeholder="Search Users (press enter to search)"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          {matchingPlatforms.length > 20 && (
            <Pagination
              style={{ float: 'right' }}
              current={page}
              pageSize={20}
              total={matchingPlatforms.length}
              onChange={(page) => setPage(page)}
              showSizeChanger={false}
            />
          )}
          <Button icon={<PlusOutlined />} onClick={() => setIsCreating(true)}>
            Add Platform
          </Button>
        </div>
        <Table dataSource={paginatedPlatforms} columns={columns} />
        <UpsertLtiPlatformModal
          focus={focus}
          setFocus={setFocus}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          onCreate={createLtiPlatform}
          onUpdate={updateLtiPlatform}
        />
      </div>
    </>
  )
}
