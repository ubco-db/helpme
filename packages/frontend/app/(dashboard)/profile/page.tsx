import { ReactElement } from 'react'
import ProfileSettings from './components/ProfileSettings'

export default function ProfilePage(): ReactElement {
  return (
    <div className="mt-8">
      <div className="header">
        <h2 className="mb-2">Settings</h2>
      </div>
      <ProfileSettings />
    </div>
  )
}
