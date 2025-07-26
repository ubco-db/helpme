'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import {
  CourseChatbotSettings,
  LLMType,
  OrganizationChatbotSettings,
} from '@koh/common'
import OrganizationChatbotSettingsForm from '@/app/(dashboard)/organization/ai/components/OrganizationChatbotSettingsForm'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { Divider, Input, message, Pagination, Table, Tabs, Tooltip } from 'antd'
import CourseSettingTable from '@/app/(dashboard)/organization/ai/components/CourseSettingTable'

export default function OrganizationChatbotSettingsPage(): ReactElement {
  const { userInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)
  const [organizationSettings, setOrganizationSettings] =
    useState<OrganizationChatbotSettings>()
  const [courseChatbotSettingsInstances, setCourseSettingsInstances] =
    useState<CourseChatbotSettings[]>()

  const organizationId = useMemo(
    () => Number(userInfo?.organization?.orgId) ?? -1,
    [userInfo?.organization?.orgId],
  )

  useEffect(() => {
    const fetchOrganizationSettings = async () => {
      if (organizationSettings) return

      await API.chatbot.adminOnly
        .getOrganizationSettings(organizationId)
        .then((response) => {
          if (response) {
            setOrganizationSettings(response)
          }
        })
        .catch((err) => {
          if ('status' in err && err.status != 404) {
            message.error(
              `Failed to retrieve organization chatbot settings: ${getErrorMessage(err)}`,
            )
          }
        })
    }

    const fetchCourseSettingsInstances = async () => {
      if (!organizationSettings) return

      await API.chatbot.adminOnly
        .getOrganizationCourseSettings(organizationId)
        .then((response) => {
          if (response) {
            setCourseSettingsInstances(response)
          }
        })
        .catch((err) => {
          if ('status' in err && err.status != 404) {
            message.error(
              `Failed to retrieve organization course chatbot settings instances: ${getErrorMessage(err)}`,
            )
          }
        })
    }

    const fetchData = async () => {
      setIsLoading(true)
      await Promise.all([
        await fetchOrganizationSettings(),
        await fetchCourseSettingsInstances(),
      ]).finally(() => setIsLoading(false))
    }
    fetchData().then()
  }, [organizationId, organizationSettings])

  if (isLoading) {
    return <CenteredSpinner tip={'Loading...'} />
  }

  return (
    <div>
      <title>{`HelpMe | ${organizationSettings != undefined ? '' : 'Creating '}Organization Chatbot Settings`}</title>
      <div className={'flex flex-col gap-8'}>
        <div className="flex flex-col gap-4">
          <h3 className="text-4xl font-bold text-gray-900">
            {organizationSettings == undefined
              ? 'Create Organization Chatbot Settings'
              : 'Organization Chatbot Settings'}
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            {organizationSettings == undefined
              ? 'Create a configuration that defines the providers and chatbot models available to all courses in your organization.'
              : "View and modify the configuration for your organization's chatbot, including the available providers, chatbot models and default settings."}
          </p>
        </div>
        {organizationSettings && courseChatbotSettingsInstances ? (
          <Tabs defaultActiveKey={'1'}>
            <Tabs.TabPane tab={'Organization Chatbot Settings'} key={'1'}>
              <OrganizationChatbotSettingsForm
                organizationId={organizationId}
                organizationSettings={organizationSettings}
                setSettings={setOrganizationSettings}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={'Chatbot Settings for Courses'} key={'2'}>
              <CourseSettingTable
                organizationId={organizationId}
                organizationSettings={organizationSettings}
                courseSettingsInstances={courseChatbotSettingsInstances}
                onUpdate={() => {
                  return
                }}
              />
            </Tabs.TabPane>
          </Tabs>
        ) : (
          <>
            <Divider />
            <OrganizationChatbotSettingsForm
              organizationId={organizationId}
              organizationSettings={organizationSettings}
              setSettings={setOrganizationSettings}
            />
          </>
        )}
      </div>
    </div>
  )
}
