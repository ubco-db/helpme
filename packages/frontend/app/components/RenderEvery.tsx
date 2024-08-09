import { useState, useEffect, useCallback, ReactNode } from 'react'

interface RenderEveryProps {
  render: () => ReactNode
  /** ms between rerenders */
  interval: number
}

/**
 * A React component that re-renders its children at specified intervals.
 *
 * This component is useful for cases where you need to update the UI at regular intervals,
 * for example, to display a live clock, countdown timer, or any other dynamic content that changes over time.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {() => ReactNode} props.render - A function that returns the ReactNode to be rendered. This function will be called on each re-render.
 * @param {number} props.interval - The interval in milliseconds between each re-render.
 * @returns {ReactNode} The ReactNode returned by the `render` function.
 */
const RenderEvery: React.FC<RenderEveryProps> = ({ render, interval }) => {
  const [, updateState] = useState({})
  const forceUpdate = useCallback(() => updateState({}), [])

  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate()
    }, interval)

    return () => {
      clearInterval(timer)
    }
  }, [forceUpdate, interval])

  return <>{render()}</>
}

export default RenderEvery
