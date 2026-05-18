'use client'

import {
  BellOutlined,
  BookOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  QrcodeOutlined,
  RobotOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { CourseSettingsResponse, Role } from '@koh/common'
import { Menu, MenuProps } from 'antd'
import { usePathname, useRouter } from 'next/navigation'

type MenuItem = Required<MenuProps>['items'][number]

enum CourseAdminOptions {
  CHECK_IN = 'CHECK_IN',
  ROSTER = 'ROSTER',
  EXPORT_DATA = 'EXPORT_DATA',
  QUEUE_INVITES = 'QUEUE_INVITES',
  EDIT_QUESTIONS = 'EDIT_QUESTIONS',
  SETTINGS = 'SETTINGS',
  LMS_SETTINGS = 'LMS_SETTINGS',
  CHATBOT_SETTINGS = 'CHATBOT_SETTINGS',
  CHATBOT_KNOWLEDGE_BASE = 'CHATBOT_KNOWLEDGE_BASE',
  CHATBOT_QUESTIONS = 'CHATBOT_QUESTIONS',
  EMBEDDABLE_QUESTIONS = 'EMBEDDABLE_QUESTIONS',
  EMBEDDABLE_ASSESSMENTS = 'EMBEDDABLE_ASSESSMENTS',
  EMBEDDABLE_QUESTIONS_ANSWERS = 'EMBEDDABLE_QUESTIONS_ANSWERS',
  EMBEDDABLE_ASSESSMENTS_ANSWERS = 'EMBEDDABLE_ASSESSMENTS_ANSWERS',
}

enum SubMenus {
  EMBEDDABLE_QUESTIONS_MENU = 'EMBEDDABLE_QUESTIONS_MENU',
  EMBEDDABLE_ASSESSMENTS_MENU = 'EMBEDDABLE_ASSESSMENTS_MENU',
}

const SubMenuMap: Record<keyof typeof SubMenus, CourseAdminOptions[]> = {
  [SubMenus.EMBEDDABLE_ASSESSMENTS_MENU]: [
    CourseAdminOptions.EMBEDDABLE_ASSESSMENTS,
    CourseAdminOptions.EMBEDDABLE_ASSESSMENTS_ANSWERS,
  ],
  [SubMenus.EMBEDDABLE_QUESTIONS_MENU]: [
    CourseAdminOptions.EMBEDDABLE_QUESTIONS,
    CourseAdminOptions.EMBEDDABLE_QUESTIONS_ANSWERS,
  ]
}

type NestedType = Record<string,Record<number,string>>
const nested: NestedType  = {
  [CourseAdminOptions.EMBEDDABLE_QUESTIONS_ANSWERS]: {
    5: 'answers',
    4: 'embeddable_questions',
  },
  [CourseAdminOptions.EMBEDDABLE_ASSESSMENTS_ANSWERS]: {
    5: 'answers',
    4: 'embeddable_questions',
  },
}

type CourseSettingsManyProps = {
  courseRole: Role
  courseFeatures?: CourseSettingsResponse
  courseId: number
}

const CourseSettingsMenu: React.FC<CourseSettingsManyProps> = ({
  courseRole,
  courseFeatures,
  courseId,
}) => {
  const router = useRouter()
  const pathname = usePathname()

  const handleMenuClick = (item: any) => {
    const basePath = `/course/${courseId}/settings`
    switch (item.key) {
      case CourseAdminOptions.SETTINGS:
        router.push(basePath)
        break
      case CourseAdminOptions.CHECK_IN:
        router.push(`${basePath}/check_in`)
        break
      case CourseAdminOptions.ROSTER:
        router.push(`${basePath}/roster`)
        break
      case CourseAdminOptions.QUEUE_INVITES:
        router.push(`${basePath}/queue_invites`)
        break
      case CourseAdminOptions.EXPORT_DATA:
        router.push(`${basePath}/export_data`)
        break
      case CourseAdminOptions.EDIT_QUESTIONS:
        router.push(`${basePath}/edit_questions`)
        break
      case CourseAdminOptions.LMS_SETTINGS:
        router.push(`${basePath}/lms_integrations`)
        break
      case CourseAdminOptions.CHATBOT_SETTINGS:
        router.push(`${basePath}/chatbot_settings`)
        break
      case CourseAdminOptions.CHATBOT_KNOWLEDGE_BASE:
        router.push(`${basePath}/chatbot_knowledge_base`)
        break
      case CourseAdminOptions.CHATBOT_QUESTIONS:
        router.push(`${basePath}/chatbot_questions`)
        break
      case CourseAdminOptions.EMBEDDABLE_QUESTIONS:
        router.push(`${basePath}/embeddable_questions`)
        break
      case CourseAdminOptions.EMBEDDABLE_QUESTIONS_ANSWERS:
        router.push(`${basePath}/embeddable_questions/answers`)
        break
      case CourseAdminOptions.EMBEDDABLE_ASSESSMENTS:
        router.push(`${basePath}/embeddable_assessments`)
        break
      case CourseAdminOptions.EMBEDDABLE_ASSESSMENTS_ANSWERS:
        router.push(`${basePath}/embeddable_assessments/answers`)
        break
    }
  }

  const getNested = (path: string[]) => {
    let nestedPass;
    for (const enumItem of Object.keys(nested).map(v => v as unknown as CourseAdminOptions)) {
      const entry = nested[enumItem];
      let pass = true;
      for (const index of Object.keys(entry).map(v => parseInt(v))) {
        if (path[index] !== entry[index]) {
          pass = false;
          break;
        }
      }
      if (pass) {
        nestedPass = enumItem;
        break;
      }
    }
    if (nestedPass)
      return nestedPass;
  }

  const handleCurrentSubMenu = () => {
    const path = pathname.split('/')

    const enumValue = handleCurrentMenuItem()

    let pass
    for (const enumItem of Object.keys(SubMenuMap).map(v => v as unknown as SubMenus)) {
      if (SubMenuMap[enumItem].includes(enumValue)) {
        pass = enumItem;
        break;
      }
    }

    return [pass as unknown as string]
  }

  const handleCurrentMenuItem = () => {
    const path = pathname.split('/')

    const nested = getNested(path)
    if (nested)
      return nested

    return CourseAdminOptions[
      path[path.length - 1].toUpperCase() as keyof typeof CourseAdminOptions
    ]
  }

  const baseMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.QUEUE_INVITES,
      icon: <QrcodeOutlined />,
      label: 'Queue Invites',
    },
    {
      key: CourseAdminOptions.EDIT_QUESTIONS,
      icon: <TableOutlined />,
      label: 'Edit Queue Questions',
    },
    {
      key: CourseAdminOptions.EXPORT_DATA,
      icon: <DownloadOutlined />,
      label: 'Export Data',
    },
    {
      type: 'divider',
    },
    {
      key: CourseAdminOptions.CHATBOT_SETTINGS,
      icon: <RobotOutlined />,
      label: 'Chatbot Settings',
    },
    {
      key: CourseAdminOptions.CHATBOT_KNOWLEDGE_BASE,
      icon: <RobotOutlined />,
      label: 'Chatbot Knowledge Base',
    },
    {
      key: CourseAdminOptions.CHATBOT_QUESTIONS,
      icon: <RobotOutlined />,
      label: 'Edit Chatbot Questions',
    },
    {
      type: 'divider',
    },
    {
      key: SubMenus.EMBEDDABLE_QUESTIONS_MENU,
      icon: <BookOutlined />,
      label: 'Embeddable Questions',
      children: [
        {
          key: CourseAdminOptions.EMBEDDABLE_QUESTIONS,
          icon: <UnorderedListOutlined />,
          label: 'Manage',
        },
        {
          key: CourseAdminOptions.EMBEDDABLE_QUESTIONS_ANSWERS,
          icon: <FolderOpenOutlined />,
          label: 'Answers'
        }
      ]
    },
    {
      key: SubMenus.EMBEDDABLE_ASSESSMENTS_MENU,
      icon: <BookOutlined />,
      label: 'Embeddable Assignments',
      children: [
        {
          key: CourseAdminOptions.EMBEDDABLE_ASSESSMENTS,
          icon: <UnorderedListOutlined />,
          label: 'Manage',
        },
        {
          key: CourseAdminOptions.EMBEDDABLE_ASSESSMENTS_ANSWERS,
          icon: <FolderOpenOutlined />,
          label: 'Answers'
        }
      ]
    }
  ]

  const professorMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.SETTINGS,
      icon: <SettingOutlined />,
      label: 'General Settings',
    },
    {
      key: CourseAdminOptions.ROSTER,
      icon: <BellOutlined />,
      label: 'Course Roster',
    },
    {
      key: CourseAdminOptions.LMS_SETTINGS,
      icon: <LinkOutlined />,
      label: 'LMS Integrations',
    },
  ]

  if (courseFeatures?.queueEnabled) {
    professorMenuItems.push({
      key: CourseAdminOptions.CHECK_IN,
      icon: <ScheduleOutlined />,
      label: 'TA Check In/Out Times',
    })
  }

  const menuItems =
    courseRole === Role.PROFESSOR
      ? [...professorMenuItems, ...baseMenuItems]
      : baseMenuItems

  return (
    <Menu
      defaultOpenKeys={handleCurrentSubMenu()}
      defaultSelectedKeys={[handleCurrentMenuItem()]}
      onClick={(item) => handleMenuClick(item)}
      className="bg-[#f8f9fb]"
      items={menuItems}
      mode={'inline'}
    />
  )
}

export default CourseSettingsMenu
