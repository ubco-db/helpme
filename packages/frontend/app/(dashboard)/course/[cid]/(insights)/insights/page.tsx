// TODO

import { PlusCircleOutlined } from '@ant-design/icons'

export default async function InsightsPage() {
  return (
    <div>
      <div className="float-end flex flex-col gap-4 rounded-md border-2 border-zinc-300 border-opacity-50 bg-white p-4 shadow-lg">
        <span>
          <b>Dashboard Presets</b>
        </span>
        <select>
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
        <button className="bg-helpmeblue md:hover:bg-helpmeblue-light rounded-lg p-2 text-white transition-all">
          <PlusCircleOutlined />
          <span className="pl-1">Create New Preset</span>
        </button>
      </div>
      BLEH
    </div>
  )
}
