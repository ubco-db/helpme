import React from 'react'
import GlanceCard from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/GlanceCard'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/outputComponents/InsightComponent'

const InsightValueComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
}) => {
  return (
    <GlanceCard title={insight.title} description={insight.description}>
      {insight.output as string}
    </GlanceCard>
  )
}

export default InsightValueComponent
