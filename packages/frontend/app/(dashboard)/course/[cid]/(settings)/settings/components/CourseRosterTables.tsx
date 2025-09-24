'use client'

import { Role } from '@koh/common'
import { useState } from 'react'
import CourseRosterTable from './CourseRosterTable'

type CourseRosterTablesProps = {
  courseId: number
}

const CourseRosterTables: React.FC<CourseRosterTablesProps> = ({
  courseId,
}) => {
  const [updateFlag, setUpdateFlag] = useState(false)
  const refreshTables = () => {
    setUpdateFlag((prevFlag) => !prevFlag)
  }

  return (
    <div className="space-y-5">
      <CourseRosterTable
        courseId={courseId}
        role={Role.PROFESSOR}
        listTitle={'Professors'}
        displaySearchBar={false}
        searchPlaceholder="Search Professors"
        onRoleChange={refreshTables}
        updateFlag={updateFlag}
      />

      <CourseRosterTable
        courseId={courseId}
        role={Role.TA}
        listTitle={'Teaching Assistants'}
        displaySearchBar={true}
        searchPlaceholder="Search TAs"
        onRoleChange={refreshTables}
        updateFlag={updateFlag}
      />

      <CourseRosterTable
        courseId={courseId}
        role={Role.STUDENT}
        listTitle={'Students'}
        displaySearchBar={true}
        searchPlaceholder="Search students"
        onRoleChange={refreshTables}
        updateFlag={updateFlag}
        hideSensitiveInformation={true}
      />
    </div>
  )
}

export default CourseRosterTables
