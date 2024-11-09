import React from 'react'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/(insights)/components/outputComponents/InsightComponent'
import { Divider } from 'antd'

const InsightValueComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
  filterContent,
}) => {
  return (
    <div className="max-h-fit flex-[1_1_auto] rounded-md bg-white p-4 shadow-lg transition-all">
      <div className={'flex flex-row items-center justify-between'}>
        <div className="flex flex-col">
          <b>{insight.title}</b>
          <p>{insight.description}</p>
        </div>
        {filterContent}
      </div>
      <Divider className={'my-4'} />
      <div className={'flex flex-row items-center justify-center gap-2'}>
        <div
          className={
            'text-helpmeblue border-helpmeblue min-w-fit rounded-lg border-2 p-2 font-bold'
          }
        >
          {insight.output as string}
        </div>
      </div>
    </div>
  )
}

export default InsightValueComponent
