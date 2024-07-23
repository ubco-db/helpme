import { Spin } from 'antd'
import { ReactElement } from 'react'

interface CenteredSpinnerProps {
  tip: string
}

const CenteredSpinner: React.FC<CenteredSpinnerProps> = ({
  tip,
}): ReactElement => {
  return (
    <div className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip={tip}>
        <div className="p-20" />
      </Spin>
    </div>
  )
}

export default CenteredSpinner
