import { ReactElement } from 'react'
import ProfileSettings from './components/ProfileSettings'

export default function ProfilePage(): ReactElement {
  return (
    <div className="flex flex-grow flex-col md:mt-2">
      <h1 className="mb-2 hidden md:block">Profile Settings</h1>
      <ProfileSettings />
    </div>
  )
}
