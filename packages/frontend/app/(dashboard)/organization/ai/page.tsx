'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import { CourseChatbotSettings, OrganizationChatbotSettings } from '@koh/common'
import OrganizationChatbotSettingsForm from '@/app/(dashboard)/organization/ai/components/OrganizationChatbotSettingsForm'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { Divider, message, Tabs } from 'antd'
import CourseSettingTable from '@/app/(dashboard)/organization/ai/components/CourseSettingTable'
import { useRouter, useSearchParams } from 'next/navigation'

export default function OrganizationChatbotSettingsPage(): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const [currentTab, setCurrentTab] = useState<'organization' | 'course'>(
    'organization',
  )

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab != undefined && (tab == 'organization' || tab == 'course')) {
      setCurrentTab(tab)
    }
  }, [searchParams])

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

  if (isLoading && !organizationSettings) {
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
          <Tabs
            activeKey={currentTab}
            defaultActiveKey={'organization'}
            onChange={(value) => {
              router.push(`/organization/ai?tab=${value}`)
            }}
            items={[
              {
                key: 'organization',
                label: 'Organization Chatbot Settings',
                children: (
                  <OrganizationChatbotSettingsForm
                    organizationId={organizationId}
                    organizationSettings={organizationSettings}
                    setSettings={setOrganizationSettings}
                  />
                ),
              },
              {
                key: 'course',
                label: 'Chatbot Settings for Courses',
                children: (
                  <CourseSettingTable
                    organizationSettings={organizationSettings}
                    courseSettingsInstances={courseChatbotSettingsInstances}
                    onUpdate={(courseSettings: CourseChatbotSettings) => {
                      const indexOf =
                        courseChatbotSettingsInstances?.findIndex(
                          (c) => c.id == courseSettings.id,
                        ) ?? -1
                      if (courseChatbotSettingsInstances) {
                        if (indexOf >= 0) {
                          setCourseSettingsInstances((prev) => [
                            ...prev!.slice(0, indexOf),
                            courseSettings,
                            ...prev!.slice(indexOf + 1),
                          ])
                        } else {
                          setCourseSettingsInstances((prev) => [
                            ...(prev ?? []),
                            courseSettings,
                          ])
                        }
                      } else {
                        setCourseSettingsInstances([courseSettings])
                      }
                    }}
                  />
                ),
              },
            ]}
          />
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
