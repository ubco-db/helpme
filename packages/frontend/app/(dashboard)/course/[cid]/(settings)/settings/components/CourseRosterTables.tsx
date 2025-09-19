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
  // Note that you are NOT supposed to do React this way, since this basically breaks the 1-directional structure of react by allowing sibling components to update each other's state, making the code harder to follow.
  // The way to actually do this is to move the states up here and pass it down to the components (see https://react.dev/learn/tutorial-tic-tac-toe#lifting-state-up for an example).
  // This *would* result in a bunch of really similar state variables, in which case you would do either an array or object, e.g. const [users, setUsers] = useState<{profs: UserPartial[], students: UserPartial[], etc.}>
  // Only reason why I'm leaving it like this is because this component is relatively isolated and it's not too hard to follow (also I'm lazy and the current solution works fine), but pretty much don't copy this pattern anywhere.
  // Fun fact: this 'updateFlag' was one of the first changes I made to the codebase (because before if you changed someone's role, they wouldn't appear in the other table until you refreshed the page)
  // - Adam
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
