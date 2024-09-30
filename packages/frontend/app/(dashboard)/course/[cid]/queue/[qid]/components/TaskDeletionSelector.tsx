'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfigTasks, Task, TaskTree, transformIntoTaskTree } from '@koh/common'
import { getBrightness } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'
import { ArrowRightOutlined } from '@ant-design/icons'

interface DeletableTaskProps {
  taskName: string
  taskColor: string
  taskID?: string
  onChangeWithID?: (taskID: string, checked: boolean) => void
  checked: boolean
}

const DeletableTask: React.FC<DeletableTaskProps> = ({
  taskName,
  taskColor,
  taskID,
  onChangeWithID,
  checked,
}) => {
  const textColor = checked
    ? getBrightness(taskColor) < 128
      ? 'lightcoral'
      : 'darkred'
    : getBrightness(taskColor) < 128
      ? 'white'
      : 'black'

  const handleClick = () => {
    if (onChangeWithID && taskID) {
      onChangeWithID(taskID, !checked)
    }
  }

  // for making it so you can press enter to toggle it
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleClick()
    }
  }

  // for applying hover and focus styles
  const [isHovered, setIsHovered] = useState(false)
  const handleMouseEnter = () => {
    setIsHovered(true)
  }
  const handleMouseLeave = () => {
    setIsHovered(false)
  }
  const handleFocus = () => {
    setIsHovered(true)
  }
  const handleBlur = () => {
    setIsHovered(false)
  }

  return (
    <div
      style={{
        backgroundColor: taskColor,
        borderRadius: '15px',
        padding: '4px 9px',
        margin: '2px',
        display: 'inline-block',
        cursor: 'pointer',
        border: `1px solid ${tinycolor(taskColor).darken(10).toString()}`,
        boxShadow: isHovered
          ? `0 0 0 2px ${tinycolor(taskColor).darken(10).toString()}`
          : undefined,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="checkbox"
      aria-checked={checked}
    >
      <div style={{ fontSize: 'smaller', color: textColor }}>
        {checked ? (
          <s
            style={{
              display: checked ? 'inline' : 'none',
            }}
          >
            {taskName}
          </s>
        ) : (
          taskName
        )}
      </div>
    </div>
  )
}

interface TaskDeleteSelectorProps {
  configTasks: ConfigTasks
  onChange?: (newSelectedTasks: string[]) => void
  value?: string[]
  className?: string
  [key: string]: any
}

const TaskDeleteSelector: React.FC<TaskDeleteSelectorProps> = ({
  configTasks,
  onChange,
  value,
  className,
  ...props
}) => {
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)

  const [selectedTasks, setSelectedTasks] = useState<string[]>(value || [])

  useEffect(() => {
    const configTasksCopy = {
      ...configTasks,
    } // Create a copy of configTasks (since the function will mutate it)

    setTaskTree(transformIntoTaskTree(configTasksCopy))
    setSelectedTasks(value || [])
  }, [configTasks, value])

  const handleCurrentTaskClick = useCallback(
    (taskID: string, checked: boolean) => {
      const newSelectedTasks = checked
        ? [...selectedTasks, taskID]
        : selectedTasks.filter((id) => id !== taskID)

      setSelectedTasks(newSelectedTasks)
      if (onChange) {
        onChange(newSelectedTasks)
      }
    },
    [selectedTasks, onChange],
  )

  const printDependents = useCallback(
    (taskID: string, accumulatedTasks: JSX.Element[] = []) => {
      const task: Task = taskTree[taskID]

      if (!task) {
        console.error('Task not found in taskTree: ', taskID)
        return accumulatedTasks
      }

      // Display the task and mark it as already been displayed
      accumulatedTasks.push(
        <div key={taskID} className="flex items-center">
          {task.precondition && <ArrowRightOutlined />}
          <DeletableTask
            taskName={task.display_name}
            taskColor={task.color_hex}
            taskID={taskID}
            checked={selectedTasks.includes(taskID)}
            onChangeWithID={handleCurrentTaskClick}
          />
        </div>,
      )
      task.checked = true

      // Now that the task has been displayed, display any tasks that depend on it
      for (const tempTask in taskTree) {
        if (
          taskTree[tempTask].precondition &&
          taskTree[tempTask].precondition.taskId === taskID
        ) {
          printDependents(tempTask, accumulatedTasks)
        }
      }

      return accumulatedTasks
    },
    [taskTree, selectedTasks, handleCurrentTaskClick],
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

  // TODO: add a tooltip that shows all the info
  return (
    <div className={className} role="group" {...props}>
      {printTasks}
    </div>
  )
}

export default TaskDeleteSelector
