'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import { OrganizationChatbotSettings } from '@koh/common'
import CreateOrganizationChatbotSettings from '@/app/(dashboard)/organization/ai/components/CreateOrganizationChatbotSettings'
import CenteredSpinner from '@/app/components/CenteredSpinner'

export default function OrganizationChatbotSettingsPage(): ReactElement {
  const { userInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)
  const [settingsNotCreated, setSettingsNotCreated] = useState(false)
  const [_organizationSettings, setOrganizationSettings] =
    useState<OrganizationChatbotSettings>()

  const organizationId = useMemo(
    () => Number(userInfo?.organization?.orgId) ?? -1,
    [userInfo?.organization?.orgId],
  )

  const fetchOrganizationSettings = async () => {
    await API.chatbot.adminOnly
      .getOrganizationSettings(organizationId)
      .then((response) => {
        setOrganizationSettings(response)
        setSettingsNotCreated(false)
      })
      .catch((err) => {
        if ('status' in err && err.status == 404) {
          setSettingsNotCreated(true)
        }
      })
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      await Promise.all([await fetchOrganizationSettings()]).finally(() =>
        setIsLoading(false),
      )
    }
    fetchData().then()
  }, [organizationId])

  if (isLoading) {
    return <CenteredSpinner tip={'Loading...'} />
  }

  if (settingsNotCreated) {
    return (
      <CreateOrganizationChatbotSettings
        organizationId={organizationId}
        setSettings={setOrganizationSettings}
      />
    )
  }

  return <div>This is a placeholder!!!!</div>
}
