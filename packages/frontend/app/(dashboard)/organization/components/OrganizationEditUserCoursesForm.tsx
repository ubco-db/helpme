import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  GetOrganizationUserResponse,
} from '@koh/common'
import { Button, message, Table } from 'antd'
import { ColumnsType } from 'antd/lib/table'
import { useState } from 'react'

type OrganizationEditUserCoursesFormProps = {
  userData: GetOrganizationUserResponse
  organization: GetOrganizationResponse
  fetchUserData: () => void
}

interface CourseType {
  id: number
  name: string
  role: string
}

const courseColumns: ColumnsType<CourseType> = [
  {
    title: 'Course Code',
    dataIndex: 'id',
  },
  {
    title: 'Course Name',
    dataIndex: 'name',
  },
  {
    title: 'Course Role',
    dataIndex: 'role',
  },
]

const OrganizationEditUserCoursesForm: React.FC<
  OrganizationEditUserCoursesFormProps
> = ({ userData, organization, fetchUserData }) => {
  const [hasSelected, setHasSelected] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const onSelectChange = (selectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(selectedRowKeys)
    setHasSelected(selectedRowKeys.length > 0)
  }

  const dropCourses = async () => {
    if (!hasSelected) {
      message.error('No courses were selected')
      return
    }

    await API.organizations
      .dropUserCourses(
        organization?.id,
        userData.user.id,
        selectedRowKeys as number[],
      )
      .then(() => {
        message.success('User courses were dropped')
        setTimeout(async () => {
          fetchUserData()
        }, 1750)
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  return (
    <div>
      <Button
        type="primary"
        danger
        disabled={!hasSelected}
        style={{ marginBottom: 10 }}
        onClick={dropCourses}
        className="h-auto w-full p-3"
      >
        Drop Courses
      </Button>

      <Table
        dataSource={userData.courses}
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectChange,
        }}
        columns={courseColumns}
      />
    </div>
  )
}

export default OrganizationEditUserCoursesForm
