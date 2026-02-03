'use client'

import { ReactElement, useEffect, useState } from 'react'
import { Badge, Button, Card, message, Table } from 'antd'
import { useWebSocket } from '@/app/contexts/WebSocketContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ColumnProps } from 'antd/es/table'

type DataReceived = { event: string; when: Date; data: any }
function onDataReceived(
  setDataReceived: React.Dispatch<React.SetStateAction<DataReceived[]>>,
  event: string,
  data: any,
) {
  setDataReceived((prev) => [
    ...prev,
    {
      event: event,
      when: new Date(),
      data: JSON.stringify(data),
    },
  ])
}
const tableDateTimeFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})
const dataReceivedColumns: ColumnProps[] = [
  {
    key: 'event',
    title: 'Event',
    dataIndex: 'event',
  },
  {
    key: 'when',
    title: 'Received at',
    dataIndex: 'when',
    render: (date: Date) => tableDateTimeFormat.format(date),
  },
  {
    key: 'data',
    title: 'Data',
    dataIndex: 'data',
  },
]
export default function AdminDebugPage(): ReactElement {
  const webSocket = useWebSocket()
  const [healthCheck, setHealthCheck] = useState(false)
  const [healthCheckUpdated, setHealthCheckUpdated] = useState(new Date())
  const [dataReceived, setDataReceived] = useState<DataReceived[]>([])

  useEffect(() => {
    webSocket.onMessageEvent.on('healthcheck', function (value: boolean) {
      setHealthCheck(value)
      setHealthCheckUpdated(new Date())
      onDataReceived(setDataReceived, 'healthcheck', value)
    })
  }, [webSocket.onMessageEvent])

  const runFx = async (fxName: string) => {
    try {
      const result = await (webSocket as any)[fxName]()
      if (result.success) {
        if (fxName == 'connect') {
          setHealthCheck(true)
          setHealthCheckUpdated(new Date())
        } else if (fxName == 'disconnect') {
          setHealthCheck(false)
          setHealthCheckUpdated(new Date())
        }
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  return (
    <>
      <div className={'flex w-full flex-grow flex-col gap-4'}>
        <h1>Debug Tools</h1>
        <h2>Client Web Socket</h2>
        <Card classNames={{ header: 'hidden' }}>
          <div
            className={'flex w-full flex-col items-center justify-center gap-2'}
          >
            <div className={'flex justify-center gap-1'}>
              <Button onClick={() => runFx('initialize')}>
                Initialize Websocket
              </Button>
              <Button onClick={() => runFx('connect')}>
                Connect Websocket
              </Button>
              <Button onClick={() => runFx('disconnect')}>
                Disconnect Websocket
              </Button>
            </div>
            <div className={'flex flex-col gap-1'}>
              <span className={'w-full text-center font-semibold'}>
                Connection Status
              </span>
              <div className={'flex gap-2'}>
                <Badge
                  showZero={true}
                  count={
                    healthCheck ? 'Websocket Stable' : 'Websocket Inactive'
                  }
                  color={healthCheck ? 'green' : 'red'}
                />
                <span className={'text-sm text-gray-400'}>
                  Last updated at {healthCheckUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>
            <Table
              dataSource={dataReceived}
              columns={dataReceivedColumns}
              pagination={{
                position: ['topRight', 'bottomRight'],
                pageSizeOptions: [],
                showSizeChanger: false,
                showQuickJumper: false,
                size: 'small',
              }}
            />
          </div>
        </Card>
      </div>
    </>
  )
}
