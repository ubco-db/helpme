import { cn } from '@/app/utils/generalUtils'
import { MenuOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'

const TagGroupSwitch: React.FC<{
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (tagGroupsEnabled: boolean) => void
  mobile: boolean
  className?: string
}> = ({ tagGroupsEnabled, setTagGroupsEnabled, mobile, className }) => {
  return (
    <Segmented
      className={cn(
        mobile ? 'md:hidden ' : 'hidden md:block',
        'border border-gray-200',
        className,
      )}
      size="small"
      defaultChecked={tagGroupsEnabled}
      onChange={() => {
        setTimeout(() => {
          // do a timeout to allow the animation to play
          setTagGroupsEnabled(!tagGroupsEnabled)
        }, 200)
      }}
      options={[
        { title: 'First In First Out', value: false, icon: <MenuOutlined /> },
        {
          title: 'Tag Groups',
          value: true,
          icon: (
            <div className="flex min-h-[12px] min-w-[14px] flex-col items-center justify-center">
              <div className="mb-[2px] mt-[3px] min-h-[6px] w-full rounded-[2px] border-2 border-gray-500" />
              <div className="min-h-[6px] w-full rounded-[2px] border-2 border-gray-500" />
            </div>
          ),
        },
      ]}
    />
  )
}

export default TagGroupSwitch
