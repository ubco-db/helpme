import React, { useState } from 'react'
import { PlusCircleOutlined } from '@ant-design/icons'
import { SettingsIcon } from 'lucide-react'
import { CloseIcon } from 'next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon'

type DashboardPresetComponentProps = {
  dashboardLoadedId?: number
}
const DashboardPresetComponent: React.FC<DashboardPresetComponentProps> = ({
  dashboardLoadedId,
}: DashboardPresetComponentProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const dashboardPresetWindow = (isOpen: boolean, loadedId?: number) => {
    return (
      <div
        className={`${isOpen ? '' : 'hidden'} flex flex-col gap-4 rounded-r-lg border-2 border-y-zinc-300 border-r-zinc-300 border-opacity-50 bg-white p-4 shadow-lg`}
      >
        <span>
          <b>Dashboard Presets</b>
        </span>
        <select defaultValue={loadedId}>
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
        <button className="bg-helpmeblue md:hover:bg-helpmeblue-light rounded-lg p-2 text-white transition-all">
          <PlusCircleOutlined />
          <span className="pl-1">Create New Preset</span>
        </button>
      </div>
    )
  }

  return (
    <div className="absolute right-1 flex flex-row">
      <button
        className={`${isOpen ? 'bg-zinc-300' : 'bg-helpmeblue'} ${isOpen ? 'rounded-l-lg' : 'rounded-lg'} p-2 shadow-lg ${isOpen ? 'md:hover:bg-zinc-200' : 'md:hover:bg-helpmeblue-light'} md:hover:shadow-2xl`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <CloseIcon /> : <SettingsIcon className="text-white" />}
      </button>
      {dashboardPresetWindow(isOpen, dashboardLoadedId)}
    </div>
  )
}

export default DashboardPresetComponent
