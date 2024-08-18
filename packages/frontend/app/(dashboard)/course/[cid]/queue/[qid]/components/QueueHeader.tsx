import { cn } from '@/app/utils/generalUtils'
import { ReactElement } from 'react'

interface QueueHeaderProps {
  text: string
  visibleOnDesktopOrMobile?: 'desktop' | 'mobile' | 'both'
}

const QueueHeader: React.FC<QueueHeaderProps> = ({
  text,
  visibleOnDesktopOrMobile = 'both',
}): ReactElement => {
  return (
    <h2
      className={cn(
        'mb-1 text-2xl font-semibold text-gray-900',
        visibleOnDesktopOrMobile === 'mobile' ? 'block md:hidden' : '',
        visibleOnDesktopOrMobile === 'desktop' ? 'hidden md:block' : '',
        visibleOnDesktopOrMobile === 'both' ? '' : '',
      )}
    >
      {text}
    </h2>
  )
}
export default QueueHeader
