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
    danger={variant === 'red'}
    type={variant === 'primary' ? 'primary' : 'default'}
    disabled={disabled}
    className={cn(
      'ml-2 mt-[0.35rem] md:ml-3 md:mt-0',
      disabled && 'pointer-events-none bg-opacity-40',
      variant === 'default' &&
        'border bg-white text-black hover:bg-gray-100 focus:bg-gray-100 disabled:text-gray-400',
      variant === 'primary' &&
        'bg-helpmeblue hover:bg-helpmeblue-light focus:bg-helpmeblue-light text-white',
      variant === 'red' &&
        'bg-[#e26567] text-white hover:bg-[#fc7f81] focus:bg-[#fc7f81]',
      variant === 'orange' &&
        'bg-[#ff8c00] text-white hover:border-orange-400 hover:bg-[#ffa700] focus:bg-[#ffa700]',
      variant === 'green' &&
        'bg-[#66bb6a] text-white hover:border-green-500 hover:bg-[#82c985] focus:bg-[#82c985]',
      className,
    )}
    {...props}
  >
    {children}
  </Button>
)

export default CircleButton
