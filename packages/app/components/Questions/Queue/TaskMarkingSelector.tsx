import { ReactElement, useState } from 'react'
import { Text } from '../Shared/SharedComponents'
import { ConfigTasks } from '@koh/common'

interface CheckableMarkingTaskProps {
  taskId: string
  taskName: string
  taskColor: string
  onChange: (taskId: string, checked: boolean) => void
  checked: boolean
  decorative: boolean
}

function CheckableMarkingTask({
  taskId,
  taskName,
  taskColor,
  onChange,
  checked,
  decorative,
}: CheckableMarkingTaskProps): React.ReactElement {
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
    onChange(taskId, !checked)
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

  // if it's not decorative, it's a checkbox
  return (
    <div
      style={{
        backgroundColor: !decorative ? taskColor : undefined,
        borderRadius: '15px',
        padding: '0px 7px',
        margin: '2px',
        display: 'inline-block',
        cursor: !decorative ? 'pointer' : undefined,
        border: `1px solid ${!decorative ? taskColor : 'dimgray'}`,
        boxShadow:
          isHovered && !decorative ? `0 0 0 2px ${taskColor}` : undefined,
      }}
      onClick={!decorative ? handleClick : undefined}
      onKeyDown={!decorative ? handleKeyDown : undefined}
      onMouseEnter={!decorative ? handleMouseEnter : undefined}
      onMouseLeave={!decorative ? handleMouseLeave : undefined}
      onFocus={!decorative ? handleFocus : undefined}
      onBlur={!decorative ? handleBlur : undefined}
      tabIndex={!decorative ? 0 : -1}
      role={!decorative ? 'checkbox' : undefined}
      aria-checked={checked}
      className={checked ? 'glowy' : ''}
    >
      <Text
        style={{
          fontSize: 'smaller',
          color: !decorative ? textColor : 'dimgray',
        }}
      >
        {taskName}
      </Text>
    </div>
  )
}

interface TaskMarkingSelectorProps {
  onChange: (selectedTaskIds: string[]) => void
  tasksStudentWouldLikeMarked: string[]
  configTasks: ConfigTasks
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

export default function TaskMarkingSelector({
  onChange,
  tasksStudentWouldLikeMarked,
  configTasks,
  className,
  ariaLabel,
  ariaLabelledBy,
}: TaskMarkingSelectorProps): React.ReactElement {
  const [selectedTasks, setSelectedTasks] = useState([])

  const handleTaskClick = (taskId, checked) => {
    const newSelectedTasks = checked
      ? [...selectedTasks, taskId]
      : selectedTasks.filter((id) => id !== taskId)

    setSelectedTasks(newSelectedTasks)
    onChange(newSelectedTasks)
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {Object.entries(configTasks).map(([taskKey, taskValue]) => (
        <CheckableMarkingTask
          key={taskKey}
          taskId={taskKey}
          taskName={taskValue.display_name}
          taskColor={taskValue.color_hex}
          checked={selectedTasks.includes(taskKey)}
          onChange={handleTaskClick}
          decorative={!tasksStudentWouldLikeMarked.includes(taskKey)}
        />
      ))}
    </div>
  )
}
