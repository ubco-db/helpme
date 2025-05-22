import { Card, Space, Button } from 'antd'
import Meta from 'antd/es/card/Meta'
import { ReactElement } from 'react'

type InviteCardProps = {
  title: string
  buttonLabel: string
  buttonAction: () => void
  description?: { title?: string; text?: string }
  cover?: ReactElement
  secondaryButtonLabel?: string
  secondaryButtonAction?: () => void
}

const InviteCard: React.FC<InviteCardProps> = ({
  title,
  description,
  buttonLabel,
  buttonAction,
  cover = undefined,
  secondaryButtonLabel,
  secondaryButtonAction,
}) => {
  return (
    <Card style={{ maxWidth: '38rem', textAlign: 'center' }} cover={cover}>
      <h1>{title}</h1>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Meta
          title={description ? description.title : undefined}
          description={description ? description.text : undefined}
        />
        <Button
          type="primary"
          style={{ width: '100%', height: 50, borderRadius: '5px' }}
          onClick={buttonAction}
        >
          {buttonLabel}
        </Button>
        {secondaryButtonLabel && secondaryButtonAction && (
          <Button
            style={{ width: '100%', height: 50, borderRadius: '5px' }}
            onClick={secondaryButtonAction}
          >
            {secondaryButtonLabel}
          </Button>
        )}
      </Space>
    </Card>
  )
}

export default InviteCard
