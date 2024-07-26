import { cn } from '@/app/utils/generalUtils'
import { MenuOutlined } from '@ant-design/icons'
import { Switch } from 'antd'

const TagGroupSwitch: React.FC<{
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (tagGroupsEnabled: boolean) => void
  mobile: boolean
  className?: string
}> = ({ tagGroupsEnabled, setTagGroupsEnabled, mobile, className }) => {
  return (
    <Switch
      className={cn(mobile ? 'md:hidden ' : 'hidden md:block', className)}
      defaultChecked={tagGroupsEnabled}
      onChange={() => {
        setTimeout(() => {
          // do a timeout to allow the animation to play
          setTagGroupsEnabled(!tagGroupsEnabled)
        }, 200)
      }}
      checkedChildren={
        <div className="flex min-h-[12px] flex-col items-center justify-center">
          <div className="mb-[2px] mt-[5px] min-h-[5px] w-full rounded-[1px] border border-gray-300" />
          <div className="min-h-[5px] w-full rounded-[1px] border border-gray-300" />
        </div>
      }
      unCheckedChildren={<MenuOutlined />}
    />
  )
}

export default TagGroupSwitch
