import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps } from 'antd'

interface CircleButtonProps extends ButtonProps {
  customVariant?: 'default' | 'primary' | 'red' | 'orange' | 'green' | 'gray'
}

const CircleButton: React.FC<CircleButtonProps> = ({
  children,
  className,
  customVariant = 'default',
  disabled,
  ...props
}) => (
  <Button
    size="large"
    shape="circle"
    danger={customVariant === 'red'}
    type={customVariant === 'primary' ? 'primary' : 'default'}
    disabled={disabled}
    className={cn(
      'ml-2 mt-[0.35rem] md:ml-3 md:mt-0',
      disabled && 'pointer-events-none bg-opacity-40',
      customVariant === 'default' &&
        'border bg-white text-black hover:bg-gray-100 focus:bg-gray-100 disabled:text-gray-400',
      customVariant === 'primary' &&
        'bg-helpmeblue hover:bg-helpmeblue-light focus:bg-helpmeblue-light text-white',
      customVariant === 'red' &&
        'bg-[#e26567] text-white hover:bg-[#fc7f81] focus:bg-[#fc7f81]',
      customVariant === 'orange' &&
        'bg-[#ff8c00] text-white hover:border-orange-400 hover:bg-[#ffa700] focus:bg-[#ffa700]',
      customVariant === 'green' &&
        'bg-[#66bb6a] text-white hover:border-green-500 hover:bg-[#82c985] focus:bg-[#82c985]',
      customVariant === 'gray' &&
        'bg-[#ababab] text-white hover:border-gray-400 hover:bg-[#c7c7c7] focus:bg-[#c7c7c7]',
      className,
    )}
    {...props}
  >
    {children}
  </Button>
)

export default CircleButton
