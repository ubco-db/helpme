import { useCallback, useEffect, useState } from 'react'
import { Text } from '../Shared/SharedComponents'
import { CheckOutlined } from '@ant-design/icons'
import { ConfigTasks, StudentAssignmentProgress } from '@koh/common'

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
 * note: this "Task" is only for this frontend component, the Task used in the rest of the system is a part of ConfigTasks in @koh/common
 */
interface Task {
  taskId: string
  isDone?: boolean
  checked?: boolean
  display_name?: string
  short_display_name?: string
  color_hex?: string
  blocking?: boolean
  precondition?: Task | null
  [key: string]: any // Tasks can have any number of additional properties (for expandability, might remove later)
}

interface TaskTree {
  [taskId: string]: Task
}

export function CheckableTask({
  task,
  taskId,
  onChange,
  checked,
  onMouseEnterAndFocus,
  onMouseLeaveAndBlur,
  isHovered,
}: CheckableTaskProps): React.ReactElement {
  const taskName = task.display_name ? task.display_name : taskId
  const taskColor = task.color_hex ? task.color_hex : '#f0f0f0'
  const disabled = task.isDone ? true : false

  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
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
        border: `1px solid ${task.isDone ? 'lightgray' : taskColor}`,
        boxShadow: isHovered ? `0 0 0 2px ${taskColor}` : undefined,
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
        <Text style={{ fontSize: 'medium', color: textColor }}>{taskName}</Text>
        {task.blocking && (
          <Text style={{ fontSize: 'smaller', color: 'gray' }}>
            {' '}
            (blocking)
          </Text>
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

/**
 * Transforms a configuration object of tasks into a tree structure where each task has a reference to its prerequisite task.
 * This enables the implementation of task dependencies in the UI. Note that this function mutates the `remainingTasks` object.
 *
 * @param {Object} remainingTasks - The configTasks object to be transformed
 *
 * Example input (`remainingTasks`):
 * {
 *   "task1": {
 *     "display_name": "Task 1",
 *     "short_display_name": "1",
 *     "blocking": false,
 *     "color_hex": "#ffedb8",
 *     "precondition": null
 *   },
 *   "task2": {
 *     "display_name": "Task 2",
 *     "short_display_name": "2",
 *     "blocking": false,
 *     "color_hex": "#fadf8e",
 *     "precondition": "task1"
 *   },
 *   "task3": {
 *     "display_name": "Task 3",
 *     "short_display_name": "3",
 *     "blocking": true,
 *     "color_hex": "#f7ce52",
 *     "precondition": "task2"
 *   }
 * }
 *
 * Example output (transformed `remainingTasks`):
 * {
 *   "task1": {
 *     display_name: "Task 1",
 *     short_display_name: "1",
 *     blocking: false,
 *     color_hex: "#ffedb8",
 *     precondition: null
 *   },
 *   "task2": {
 *     display_name: "Task 2",
 *     short_display_name: "2",
 *     blocking: false,
 *     color_hex: "#fadf8e",
 *     precondition: [Object reference to task1]
 *   },
 *   "task3": {
 *     display_name: "Task 3",
 *     short_display_name: "3",
 *     blocking: true,
 *     color_hex: "#f7ce52",
 *     precondition: [Object reference to task2]
 *   }
 * }
 */
function transformIntoTaskTree(
  remainingTasks: object,
  taskTree: TaskTree = {},
  precondition: string | null = null,
): TaskTree {
  // Object.entries is like a fancy for loop. Filter is a function that takes in a subfunction; if the subfunction returns false, the element is removed from the array.
  const tasksToAdd = Object.entries(remainingTasks).filter(
    ([, taskValue]) => taskValue.precondition === precondition,
  )

  tasksToAdd.forEach(([taskKey, taskValue]) => {
    taskTree[taskKey] = {
      ...taskValue,
      taskId: taskKey,
      checked: false,
      precondition:
        precondition && !taskValue.isDone && !taskTree[precondition].isDone
          ? taskTree[precondition]
          : null,
    }

    // Now that the task has been added to the tree, we can remove the task from the remainingTasks so that it doesn't keep getting cycled through (optimization)
    delete remainingTasks[taskKey]

    // Merge the current taskTree with the taskTree created from the recursive call
    Object.assign(
      taskTree,
      transformIntoTaskTree(remainingTasks, taskTree, taskKey),
    )
  })

  return taskTree
}

//
// CREATE DEMO TASK SELECTOR
//

interface TaskSelectorProps {
  onChange: (newSelectedTasks: string[]) => void
  value: string[]
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  studentAssignmentProgress: StudentAssignmentProgress
  configTasks: ConfigTasks
}

export function TaskSelector({
  configTasks,
  studentAssignmentProgress,
  onChange,
  value,
  className,
  ariaLabel,
  ariaLabelledBy,
}: TaskSelectorProps): React.ReactElement {
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)

  const [selectedTasks, setSelectedTasks] = useState<string[]>(value || [])

  // if either studentAssignmentProgress or configTasks changes, recompute the taskTree and reset selected tasks
  useEffect(() => {
    // First, assemble a tree data structure that will allow us to easily find the tasks that are prerequisites for each task.
    // This turns all the preconditions into object references instead of strings
    const configTasksCopy: object = { ...configTasks } // Create a copy of configTasks (since the function will mutate it)
    // For each task that is marked as done, give it the isDone = true attribute
    if (studentAssignmentProgress) {
      for (const [taskKey, taskValue] of Object.entries(
        studentAssignmentProgress,
      )) {
        if (taskValue.isDone) {
          configTasksCopy[taskKey].isDone = true
        }
      }
    }
    setTaskTree(transformIntoTaskTree(configTasksCopy))
    setSelectedTasks(value || [])
  }, [configTasks, studentAssignmentProgress, value])

  const handleTaskClick = useCallback(
    (taskId, checked) => {
      const newSelectedTasks = [...selectedTasks]
      const newTaskTree = { ...taskTree } // just to set the .checked attribute to true/false (needed for hovering effects)

      const checkStatus = { wasThereIncompleteBlockingTask: false } // need to make wasThereIncompleteBlockingTask an object so that it can be passed by reference up the stack

      const checkPreconditions = (taskID: string, checkStatus) => {
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
      onChange(newSelectedTasks)
      setTaskTree(newTaskTree)
    },
    [taskTree, selectedTasks, onChange],
  )

  const [hoveredTasks, setHoveredTasks] = useState([])

  // basically the same logic as handleTaskClick, but for hovering instead.
  const handleHover = useCallback(
    (taskId, isChecked) => {
      const newHoveredTasks = [...hoveredTasks]
      const checkStatus = { wasThereIncompleteBlockingTask: false } // need to make wasThereIncompleteBlockingTask an object so that it can be passed by reference up the stack

      const hoverPreconditions = (taskID: string, checkStatus) => {
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
