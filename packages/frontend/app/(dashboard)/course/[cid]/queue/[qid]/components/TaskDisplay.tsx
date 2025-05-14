'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfigTasks, Task, TaskTree, transformIntoTaskTree } from '@koh/common'
import { getBrightness } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'
import { ArrowRightOutlined } from '@ant-design/icons'

interface DisplayTaskProps {
  taskName: string
  taskColor: string
}

const DisplayTask: React.FC<DisplayTaskProps> = ({ taskName, taskColor }) => {
  const textColor = getBrightness(taskColor) < 128 ? 'white' : 'black'

  return (
    <div
      style={{
        backgroundColor: taskColor,
        borderRadius: '15px',
        padding: '4px 9px',
        margin: '2px',
        display: 'inline-block',
        border: `1px solid ${tinycolor(taskColor).darken(10).toString()}`,
      }}
    >
      <div style={{ fontSize: 'smaller', color: textColor }}>{taskName}</div>
    </div>
  )
}

interface TaskDisplayProps {
  configTasks: ConfigTasks
  value?: string[]
  className?: string
  [key: string]: any
}

/**
 * This displays a little display of all the tasks and their dependencies.
 * Helps give a visual of what's going on in EditQueueModal when editing tasks.
 */
const TaskDisplay: React.FC<TaskDisplayProps> = ({
  configTasks,
  value,
  className,
  ...props
}) => {
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)

  useEffect(() => {
    const configTasksCopy = {
      ...configTasks,
    } // Create a copy of configTasks (since the function will mutate it)

    setTaskTree(transformIntoTaskTree(configTasksCopy))
  }, [configTasks, value])

  const printDependents = useCallback(
    (taskID: string, accumulatedTasks: React.ReactNode[] = []) => {
      const task: Task = taskTree[taskID]

      if (!task) {
        console.error('Task not found in taskTree: ', taskID)
        return accumulatedTasks
      }

      // Display the task and mark it as already been displayed
      accumulatedTasks.push(
        <div key={taskID} className="flex items-center">
          {task.precondition && <ArrowRightOutlined />}
          <DisplayTask
            taskName={task.display_name}
            taskColor={task.color_hex}
          />
        </div>,
      )
      task.checked = true

      // Now that the task has been displayed, display any tasks that depend on it
      for (const tempTask in taskTree) {
        if (
          taskTree[tempTask].precondition &&
          taskTree[tempTask].precondition?.taskId === taskID
        ) {
          printDependents(tempTask, accumulatedTasks)
        }
      }

      return accumulatedTasks
    },
    [taskTree],
  )

  const printTasks = useMemo(() => {
    return Object.entries(taskTree).map(([taskKey, task]) => {
      // print the task and all its preconditions
      if (!task.checked) {
        return (
          <div key={taskKey} className="flex items-center justify-start">
            {printDependents(taskKey).flat()}
          </div>
        )
      }
    })
    //I'm not sure why, but putting proper dependencies here causes this to be ran more times than it should
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTree])

  return (
    <div
      className={`flex flex-wrap gap-x-1 ${className}`}
      role="group"
      {...props}
    >
      {printTasks}
    </div>
  )
}

export default TaskDisplay
