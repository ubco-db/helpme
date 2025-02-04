import React, { useCallback, useEffect, useState } from 'react'
import { CheckOutlined } from '@ant-design/icons'
import {
  ConfigTasks,
  ConfigTasksWithAssignmentProgress,
  StudentAssignmentProgress,
  Task,
  TaskTree,
  transformIntoTaskTree,
} from '@koh/common'
import { getBrightness } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'

interface CheckableTaskProps {
  task: Task
  taskId: string
  onChange: (task: string, checked: boolean) => void
  checked: boolean
  onMouseEnterAndFocus: (task: string, isHovered: boolean) => void
  onMouseLeaveAndBlur: () => void
  isHovered: boolean
}

/**
 * Checkable Task. Not to be used outside of TaskSelector
 */
const CheckableTask: React.FC<CheckableTaskProps> = ({
  task,
  taskId,
  onChange,
  checked,
  onMouseEnterAndFocus,
  onMouseLeaveAndBlur,
  isHovered,
}) => {
  const taskName = task.display_name ? task.display_name : taskId
  const taskColor = task.color_hex ? task.color_hex : '#f0f0f0'
  const disabled = task.isDone ? true : false

  const textColor = checked
    ? getBrightness(taskColor) < 128
      ? 'white'
      : 'black'
    : 'gray'

  const handleClick = () => {
    if (!disabled) onChange(taskId, !checked)
  }

  // for making it so you can press enter or space to toggle it
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!disabled) {
      if (event.key === 'Enter' || event.key === ' ') {
        handleClick()
      }
    }
  }

  // for applying hover and focus styles
  const handleMouseEnter = () => {
    if (!disabled) onMouseEnterAndFocus(taskId, checked)
  }
  const handleMouseLeave = () => {
    if (!disabled) onMouseLeaveAndBlur()
  }
  const handleFocus = () => {
    if (!disabled) onMouseEnterAndFocus(taskId, checked)
  }
  const handleBlur = () => {
    if (!disabled) onMouseLeaveAndBlur()
  }

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: task.isDone
          ? '#EEEEEE'
          : checked
            ? taskColor
            : undefined,
        borderRadius: '15px',
        padding: task.blocking ? '5px 15px' : '15px 15px',
        margin: '4px',
        display: 'inline-block',
        cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${task.isDone ? 'lightgray' : tinycolor(taskColor).darken(10).toString()}`,
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
      aria-disabled={disabled}
    >
      <div className="flex flex-col items-center justify-center">
        <span
          style={{ lineHeight: '22px', fontSize: 'medium', color: textColor }}
        >
          {taskName}
        </span>
        {task.blocking && (
          <span
            style={{ lineHeight: '22px', fontSize: 'smaller', color: 'gray' }}
          >
            {' '}
            (blocking)
          </span>
        )}
      </div>
      {task.isDone && (
        <CheckOutlined
          style={{
            color: 'green',
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            fontSize: '20px',
          }}
        />
      )}
    </div>
  )
}

interface TaskSelectorProps {
  studentAssignmentProgress: StudentAssignmentProgress | undefined
  configTasks: ConfigTasks
  onChange?: (newSelectedTasks: string[]) => void
  value?: string[]
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

/**
 * Create Demo Task Selector. Used when students are creating a demo to select which tasks they want to show in their demo.
 */
const TaskSelector: React.FC<TaskSelectorProps> = ({
  studentAssignmentProgress,
  configTasks,
  onChange,
  value,
  className,
  ariaLabel,
  ariaLabelledBy,
}) => {
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)

  const [selectedTasks, setSelectedTasks] = useState<string[]>(value || [])

  // if either studentAssignmentProgress or configTasks changes, recompute the taskTree and reset selected tasks
  useEffect(() => {
    // First, assemble a tree data structure that will allow us to easily find the tasks that are prerequisites for each task.
    // This turns all the preconditions into object references instead of strings
    const configTasksCopy: ConfigTasksWithAssignmentProgress =
      structuredClone(configTasks) // Create a copy of configTasks (since the function will mutate it)
    // For each task that is marked as done, give it the isDone = true attribute
    if (studentAssignmentProgress) {
      for (const [taskKey, taskValue] of Object.entries(
        studentAssignmentProgress,
      )) {
        if (taskValue && taskValue.isDone && configTasksCopy[taskKey]) {
          configTasksCopy[taskKey].isDone = true
        }
      }
    }
    setTaskTree(transformIntoTaskTree(configTasksCopy))
    setSelectedTasks(value || [])
  }, [configTasks, studentAssignmentProgress, value])

  const handleTaskClick = useCallback(
    (taskId: string, checked: boolean) => {
      const newSelectedTasks = [...selectedTasks]
      const newTaskTree = { ...taskTree } // just to set the .checked attribute to true/false (needed for hovering effects)

      const checkStatus = { wasThereIncompleteBlockingTask: false } // need to make wasThereIncompleteBlockingTask an object so that it can be passed by reference up the stack

      const checkPreconditions = (
        taskID: string,
        checkStatus: {
          wasThereIncompleteBlockingTask: boolean
        },
      ) => {
        const task: Task = taskTree[taskID]

        // Bubbles down until it hits a task whose precondition is null
        if (task.precondition) {
          checkPreconditions(task.precondition.taskId, checkStatus)
        }
        // Marks task as checked and bubbles back up
        if (!checkStatus.wasThereIncompleteBlockingTask) {
          if (!newSelectedTasks.includes(taskID)) {
            task.checked = true
            newSelectedTasks.push(taskID)
          }
          if (task.blocking && !task.isDone) {
            // if the task is blocking and not done, don't check any dependent tasks as it bubbles up
            console.log('blocking task not done') // leaving this here for now, maybe in the future we can give a message to the user
            checkStatus.wasThereIncompleteBlockingTask = true
          }
        }
      }

      const removeTaskAndDependents = (taskID: string) => {
        const index = newSelectedTasks.indexOf(taskID)
        if (index > -1) {
          newSelectedTasks.splice(index, 1)
          taskTree[taskID].checked = false
        }
        // Remove dependent tasks
        for (const task in taskTree) {
          if (
            taskTree[task].precondition &&
            taskTree[task].precondition.taskId === taskID
          ) {
            removeTaskAndDependents(task)
          }
        }
      }

      // if the task is being checked, check all preconditions as well
      if (checked) {
        checkPreconditions(taskId, checkStatus)
      } else {
        removeTaskAndDependents(taskId)
      }

      setSelectedTasks(newSelectedTasks)
      onChange?.(newSelectedTasks)
      setTaskTree(newTaskTree)
    },
    [taskTree, selectedTasks, onChange],
  )

  const [hoveredTasks, setHoveredTasks] = useState<string[]>([])

  // basically the same logic as handleTaskClick, but for hovering instead.
  const handleHover = useCallback(
    (taskId: string, isChecked: boolean) => {
      const newHoveredTasks = [...hoveredTasks]
      const checkStatus = { wasThereIncompleteBlockingTask: false } // need to make wasThereIncompleteBlockingTask an object so that it can be passed by reference up the stack

      const hoverPreconditions = (
        taskID: string,
        checkStatus: {
          wasThereIncompleteBlockingTask: boolean
        },
      ) => {
        const task: Task = taskTree[taskID]
        // Bubbles down until it hits a task whose precondition is null
        if (task.precondition) {
          hoverPreconditions(task.precondition.taskId, checkStatus)
        }

        // Marks task as hovered and bubbles back up
        if (!checkStatus.wasThereIncompleteBlockingTask) {
          if (!newHoveredTasks.includes(taskID)) {
            newHoveredTasks.push(taskID)
          }
          if (task.blocking && !task.isDone) {
            // if the task is blocking and not done, don't hover any dependent tasks as it bubbles up
            checkStatus.wasThereIncompleteBlockingTask = true
          }
        }
      }

      const hoverTaskAndDependents = (taskID: string) => {
        newHoveredTasks.push(taskID)
        for (const task in taskTree) {
          if (
            taskTree[task].precondition &&
            taskTree[task].precondition.taskId === taskID &&
            taskTree[task].checked
          ) {
            hoverTaskAndDependents(task)
          }
        }
      }

      // if the task has been checked, only hover the task and all dependents. Else hover the task and all the preconditions
      if (isChecked) {
        hoverTaskAndDependents(taskId)
      } else {
        hoverPreconditions(taskId, checkStatus)
      }
      setHoveredTasks(newHoveredTasks)
    },
    [taskTree, hoveredTasks],
  )

  const handleUnHover = () => {
    setHoveredTasks([])
  }

  return (
    <div
      className={className + ' flex flex-wrap'}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {Object.entries(taskTree).map(([taskKey, taskObject]) => (
        <CheckableTask
          key={taskKey}
          taskId={taskKey}
          task={taskObject}
          checked={selectedTasks.includes(taskKey)}
          onChange={handleTaskClick}
          onMouseEnterAndFocus={handleHover}
          onMouseLeaveAndBlur={handleUnHover}
          isHovered={hoveredTasks.includes(taskKey)}
        />
      ))}
    </div>
  )
}

export default TaskSelector
