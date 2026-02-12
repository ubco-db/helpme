import UserAccessTokens from './UserAccessTokens'
import ClearProfileCache from './ClearProfileCache'

const AdvancedSettings: React.FC = () => {
  return (
    <div className="flex w-full flex-col gap-2">
      <h2>Advanced Settings</h2>
      <UserAccessTokens />
      <ClearProfileCache />
    </div>
  )
}

export default AdvancedSettings
