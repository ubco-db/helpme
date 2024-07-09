import {
  BellOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  DownloadOutlined,
  AppstoreAddOutlined,
  RobotOutlined,
  ScheduleOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Col, Menu, Row, Space, Tooltip } from 'antd'
import { useRouter } from 'next/router'
import React, { ReactElement, useState } from 'react'
import styled from 'styled-components'
import { useProfile } from '../../hooks/useProfile'
import CourseRosterPage from './CourseRosterPage'
import { SettingsPanelAvatar } from './SettingsSharedComponents'
import TACheckInCheckOutTimes from './TACheckInCheckOutTimes'
import ExportData from './ExportData'
import EditQuestions from './EditQuestions'
import { useRoleInCourse } from '../../hooks/useRoleInCourse'
import { Role } from '@koh/common'
import ChatbotSettings from './ChatbotSettings'
import ChatbotQuestions from './ChatbotQuestions'
import ToggleFeaturesPage from './ToggleFeaturesPage'
import { ToasterProvider } from '../../providers/toast-provider'
import EditCourse from './EditCourse'
import { useCourseFeatures } from '../../hooks/useCourseFeatures'

export enum CourseAdminOptions {
  CHECK_IN = 'CHECK_IN',
  ROSTER = 'ROSTER',
  ADD = 'ADD',
  FEATURES = 'FEATURES',
  EXPORT = 'EXPORT',
  EDIT = 'EDIT',
  EDIT_COURSE = 'EDIT_COURSE',
  CHATBOT_SETTINGS = 'CHATBOT_SETTINGS',
  CHATBOT_QUESTIONS = 'CHATBOT_QUESTIONS',
}

interface CourseAdminPageProps {
  defaultPage: CourseAdminOptions
  courseId: number
}

const VerticalDivider = styled.div`
  @media (min-width: 767px) {
    border-right: 1px solid #cfd6de;
    margin-right: 32px;
  }
`

const CenteredText = styled.p`
  text-align: center;
`

export default function CourseAdminPanel({
  defaultPage,
  courseId,
}: CourseAdminPageProps): ReactElement {
  const role = useRoleInCourse(Number(courseId))
  const profile = useProfile()
  const courseFeatures = useCourseFeatures(courseId)

  const [currentSettings, setCurrentSettings] = useState(
    defaultPage ||
      (courseFeatures?.queueEnabled
        ? CourseAdminOptions.CHECK_IN
        : CourseAdminOptions.ROSTER),
  )

  const router = useRouter()

  return (
    <Row>
      <ToasterProvider />
      <Col span={4} style={{ textAlign: 'center' }}>
        <SettingsPanelAvatar avatarSize={20} />
        <CenteredText>
          Welcome back
          <br />
          {profile?.firstName} {profile?.lastName ?? ''}
          {!profile?.photoURL && (
            <Tooltip
              title={
                'You should consider uploading a profile picture to make yourself more recognizable to students'
              }
            >
              <span>
                <QuestionCircleOutlined
                  style={{ marginLeft: '5px' }}
                  onClick={() => {
                    router.push(`/settings?cid=${courseId}`)
                  }}
                />
              </span>
            </Tooltip>
          )}
        </CenteredText>
        <Menu
          defaultSelectedKeys={[currentSettings]}
          onClick={(e) => setCurrentSettings(e.key as CourseAdminOptions)}
          style={{ background: '#f8f9fb', paddingTop: '20px' }}
        >
          {role === Role.PROFESSOR && (
            <>
              {courseFeatures?.queueEnabled && (
                <Menu.Item
                  key={CourseAdminOptions.CHECK_IN}
                  icon={<ScheduleOutlined />}
                >
                  TA Check In/Out Times
                </Menu.Item>
              )}
              <Menu.Item
                key={CourseAdminOptions.ROSTER}
                icon={<BellOutlined />}
              >
                Course Roster
              </Menu.Item>
              {/* <Menu.Item key={CourseAdminOptions.ADD} icon={<UploadOutlined />}>
                Add students to course
              </Menu.Item> */}
              <Menu.Item
                key={CourseAdminOptions.EDIT_COURSE}
                icon={<EditOutlined />}
              >
                Update Course Invite Code
              </Menu.Item>
              <Menu.Item
                key={CourseAdminOptions.FEATURES}
                icon={<AppstoreAddOutlined />}
              >
                Toggle Features
              </Menu.Item>
            </>
          )}
          <Menu.Item
            key={CourseAdminOptions.EXPORT}
            icon={<DownloadOutlined />}
          >
            Export Data
          </Menu.Item>
          <Menu.Item key={CourseAdminOptions.EDIT} icon={<TableOutlined />}>
            Edit Questions
          </Menu.Item>
          <Menu.Item
            key={CourseAdminOptions.CHATBOT_SETTINGS}
            icon={<RobotOutlined />}
          >
            Chatbot Settings
          </Menu.Item>
          <Menu.Item
            key={CourseAdminOptions.CHATBOT_QUESTIONS}
            icon={<RobotOutlined />}
          >
            Chatbot Questions
          </Menu.Item>
        </Menu>
      </Col>
      <VerticalDivider />
      <Space direction="vertical" size={40} style={{ flexGrow: 1 }}>
        <Col span={20}>
          {currentSettings === CourseAdminOptions.EDIT_COURSE && (
            <EditCourse courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.CHECK_IN && (
            <TACheckInCheckOutTimes courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.ROSTER && (
            <CourseRosterPage courseId={courseId} />
          )}
          {/* {currentSettings === CourseAdminOptions.ADD && (
            <AddStudentsToCourse courseId={courseId} />
          )} */}
          {currentSettings === CourseAdminOptions.FEATURES && (
            <ToggleFeaturesPage courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.EXPORT && (
            <ExportData courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.EDIT && (
            <EditQuestions courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.CHATBOT_SETTINGS && (
            <ChatbotSettings courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.CHATBOT_QUESTIONS && (
            <ChatbotQuestions courseId={courseId} />
          )}
        </Col>
      </Space>
    </Row>
  )
}
