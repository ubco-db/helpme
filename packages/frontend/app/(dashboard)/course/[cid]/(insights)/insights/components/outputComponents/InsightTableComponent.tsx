import { TableOutputType } from '@koh/common'
import React from 'react'
import TableCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/TableCard'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'

const InsightTableComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
}) => {
  return (
    <TableCard
      title={insight.title}
      description={insight.description}
      tableData={insight.output as TableOutputType}
    />
  )
}

export default InsightTableComponent
