import { SelfAvatar } from '@/app/components/UserAvatar'

interface SettingsPanelAvatarProps {
  avatarSize: number
}

const SettingsPanelAvatar: React.FC<SettingsPanelAvatarProps> = ({
  avatarSize,
}) => {
  return (
    <SelfAvatar
      size={avatarSize}
      style={{
        marginTop: avatarSize / 6,
        marginBottom: avatarSize / 12,
        marginLeft: avatarSize / 6,
        marginRight: avatarSize / 6,
      }}
    />
  )
}

export default SettingsPanelAvatar
