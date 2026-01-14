import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/app/utils/generalUtils'
import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EllipsisOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Badge } from 'antd'

const CustomPagination: React.FC<{
  page: number
  numPages: number
  onChange: (page: number) => void
  displayCount?: Record<number, number>
  isTooltip?: boolean
  size?: 'small' | 'default'
}> = ({
  page,
  numPages,
  onChange,
  displayCount,
  isTooltip = false,
  size = 'default',
}) => {
  const [rightHover, setRightHover] = useState(false)
  const [leftHover, setLeftHover] = useState(false)

  const options = useMemo(() => {
    const maxWidth = size == 'small' || page == numPages || page == 1 ? 1 : 2
    const start = Math.max(page - maxWidth, 1),
      end = Math.min(page + maxWidth, numPages)
    const opts: number[] = []
    for (let i = start; i <= end; i++) {
      opts.push(i)
    }
    return opts
  }, [size, page, numPages])

  return (
    <div
      className={cn(
        isTooltip ? 'text-white' : 'text-black',
        size == 'small' ? 'text-[10px]' : 'text-xs',
        'flex flex-row items-center justify-center gap-1',
      )}
    >
      <PageButton
        page={'dec'}
        cur={page}
        total={numPages}
        onChange={onChange}
        isTooltip={isTooltip}
        size={size}
      />
      {options[0] != 1 && (
        <>
          <PageButton
            page={1}
            cur={page}
            total={numPages}
            onChange={onChange}
            isTooltip={isTooltip}
            displayCount={displayCount}
            size={size}
          />
          {options.length > 1 && options[0] - 1 > 1 && (
            <EllipsisButton
              nextOption={options[0]}
              direction={-1}
              numPages={numPages}
              onChange={onChange}
              isHovered={leftHover}
              setHovered={setLeftHover}
              size={size}
              isTooltip={isTooltip}
            />
          )}
        </>
      )}
      {options.map((i) => (
        <PageButton
          key={`page-${i}`}
          page={i}
          cur={page}
          total={numPages}
          onChange={onChange}
          isTooltip={isTooltip}
          displayCount={displayCount}
          size={size}
        />
      ))}
      {options[options.length - 1] != numPages && (
        <>
          {options.length > 1 &&
            options[options.length - 1] + 1 != numPages && (
              <EllipsisButton
                nextOption={options[options.length - 1]}
                direction={1}
                numPages={numPages}
                onChange={onChange}
                isHovered={rightHover}
                setHovered={setRightHover}
                size={size}
                isTooltip={isTooltip}
              />
            )}
          <PageButton
            page={numPages}
            cur={page}
            total={numPages}
            onChange={onChange}
            isTooltip={isTooltip}
            displayCount={displayCount}
            size={size}
          />
        </>
      )}
      <PageButton
        page={'inc'}
        cur={page}
        total={numPages}
        onChange={onChange}
        isTooltip={isTooltip}
        size={size}
      />
    </div>
  )
}

export default CustomPagination

const EllipsisButton: React.FC<{
  nextOption: number
  direction: 1 | -1
  numPages: number
  onChange: (page: number) => void
  isHovered: boolean
  setHovered: React.Dispatch<React.SetStateAction<boolean>>
  size: 'default' | 'small'
  isTooltip: boolean
}> = ({
  nextOption,
  numPages,
  direction,
  onChange,
  isHovered,
  setHovered,
  size = 'default',
  isTooltip = false,
}) => {
  useEffect(() => {
    return () => {
      setHovered(false)
    }
  }, [setHovered])

  return (
    <div className={cn(size == 'small' ? 'w-1' : 'w-4', 'relative h-8')}>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center',
          isHovered
            ? isTooltip
              ? 'text-blue-400'
              : 'text-blue-500'
            : 'text-gray-400',
        )}
        onMouseLeave={() => setHovered(false)}
        onMouseEnter={() => setHovered(true)}
        onClick={() =>
          onChange(
            direction == -1
              ? Math.max(1, nextOption + direction)
              : Math.min(numPages, nextOption + direction),
          )
        }
      >
        {isHovered ? (
          direction == -1 ? (
            <DoubleLeftOutlined />
          ) : (
            <DoubleRightOutlined />
          )
        ) : (
          <EllipsisOutlined />
        )}
      </div>
    </div>
  )
}
const PageButton: React.FC<{
  page?: number | 'dec' | 'inc'
  cur: number
  total: number
  onChange: (p: number) => void
  isTooltip?: boolean
  displayCount?: Record<number, number>
  size?: 'small' | 'default'
}> = ({
  page,
  cur,
  total,
  onChange,
  isTooltip = false,
  displayCount = {},
  size = 'default',
}) => {
  if (page == 'dec' || page == 'inc') {
    return (
      <button
        className={cn(
          (page == 'dec' && cur - 1 >= 1) || (page == 'inc' && cur + 1 <= total)
            ? isTooltip
              ? 'border-white text-white hover:text-blue-300'
              : 'border-slate-800 text-slate-800 hover:text-blue-500'
            : 'cursor-default border-gray-400 text-gray-400',
          size == 'small' ? 'w-4' : 'w-8',
          'transition-ease-in h-8 bg-transparent transition-all',
        )}
        onClick={() => {
          if (page == 'dec' && cur - 1 >= 1) {
            onChange(cur - 1)
          } else if (page == 'inc' && cur + 1 <= total) {
            onChange(cur + 1)
          }
        }}
      >
        {page == 'dec' && <LeftOutlined />}
        {page == 'inc' && <RightOutlined />}
      </button>
    )
  } else {
    return (
      <button
        className={cn(
          isTooltip
            ? 'border-2 border-white text-white hover:border-blue-300 hover:text-blue-300'
            : 'border-slate-700 text-slate-700 hover:border-blue-500 hover:text-blue-500',
          size == 'small' ? 'w-4' : 'w-8',
          'transition-ease-in h-8 rounded-md bg-transparent transition-all',
          page == cur
            ? isTooltip
              ? 'border-blue-400 text-blue-400'
              : 'border-blue-600 text-blue-600'
            : '',
          'relative font-semibold',
        )}
        onClick={() => onChange(page as number)}
      >
        {displayCount && displayCount[page as number] != undefined ? (
          <Badge
            className={'absolute -right-1 -top-1'}
            size={'small'}
            showZero={false}
            count={displayCount[page as number]}
            color={'#229CF0'}
          />
        ) : null}
        {page}
      </button>
    )
  }
}
