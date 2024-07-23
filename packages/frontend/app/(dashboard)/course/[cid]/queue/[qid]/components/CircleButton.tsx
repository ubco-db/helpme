import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps } from 'antd'

interface CircleButtonProps extends ButtonProps {
  variant?: 'default' | 'primary' | 'red' | 'orange' | 'green'
}

const CircleButton: React.FC<CircleButtonProps> = ({
  children,
  className,
  variant = 'default',
  disabled,
  ...props
}) => (
  <Button
    size="large"
    shape="circle"
    disabled={disabled}
    className={cn(
      'ml-2 mt-[0.35rem] md:ml-3',
      disabled && 'pointer-events-none bg-opacity-40',
      variant === 'default' && 'border-none bg-white text-black',
      variant === 'primary' &&
        'bg-[#3684c6] text-white hover:bg-[#3c93dd] focus:bg-[#3c93dd]',
      variant === 'red' &&
        'bg-[#e26567] text-white hover:bg-[#fc7f81] focus:bg-[#fc7f81]',
      variant === 'orange' &&
        'bg-[#ff8c00] text-white hover:bg-[#ffa700] focus:bg-[#ffa700]',
      variant === 'green' &&
        'bg-[#66bb6a] text-white hover:bg-[#82c985] focus:bg-[#82c985]',
      className,
    )}
    {...props}
  >
    {children}
  </Button>
)

export default CircleButton
