'use client'

import { API } from '@/app/api'
import {
  getEndpoint,
  getNotificationState,
  NotificationStates,
  registerNotificationSubscription,
  requestNotificationPermission,
} from '@/app/utils/notificationUtils'
import { MinusCircleOutlined } from '@ant-design/icons'
import { DesktopNotifPartial } from '@koh/common'
import { Button, List, message, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import useSWR from 'swr'

function useThisDeviceEndpoint(): null | string {
  const [endpoint, setEndpoint] = useState<null | string>(null)
  useEffect(() => {
    ;(async () => setEndpoint((await getEndpoint()) as string | null))()
  })
  return endpoint
}

function renderDeviceInfo(
  device: DesktopNotifPartial,
  isThisDevice: boolean,
): string {
  if (device.name) {
    return isThisDevice ? `${device.name} (This Device)` : device.name
  } else {
    return isThisDevice ? 'This Device' : 'Other Device'
  }
}

const DeviceNotificationPanel: React.FC = () => {
  const thisEndpoint = useThisDeviceEndpoint()
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )

  const thisDesktopNotif = profile?.desktopNotifs?.find(
    (dn) => dn.endpoint === thisEndpoint,
  )

  return (
    <div>
      <div className="flex justify-between">
        <h3>Your Devices</h3>
        {!thisDesktopNotif && (
          <Tooltip
            title={
              getNotificationState() ===
                NotificationStates.browserUnsupported &&
              'Browser does not support notifications. Please use Chrome or Firefox, and not Incognito Mode.'
            }
          >
            <Button
              onClick={async () => {
                const canNotify = await requestNotificationPermission()
                if (canNotify === NotificationStates.notAllowed) {
                  message.warning('Please allow notifications in this browser')
                }
                if (canNotify === NotificationStates.granted) {
                  await registerNotificationSubscription()
                  mutate()
                }
              }}
              disabled={
                getNotificationState() === NotificationStates.browserUnsupported
              }
              style={{ marginBottom: '4px' }}
            >
              Add This Device
            </Button>
          </Tooltip>
        )}
      </div>
      <List
        bordered
        dataSource={profile?.desktopNotifs}
        locale={{ emptyText: 'No Devices Registered To Receive Notifications' }}
        renderItem={(device: DesktopNotifPartial) => (
          <List.Item
            actions={[
              <MinusCircleOutlined
                style={{ fontSize: '20px' }}
                key={0}
                onClick={async () => {
                  await API.notif.desktop.unregister(device.id)
                  mutate()
                }}
              />,
            ]}
          >
            <List.Item.Meta
              title={renderDeviceInfo(device, device.endpoint === thisEndpoint)}
              description={`Registered ${device.createdAt.toLocaleDateString()}`}
            />
          </List.Item>
        )}
      />
    </div>
  )
}

export default DeviceNotificationPanel
