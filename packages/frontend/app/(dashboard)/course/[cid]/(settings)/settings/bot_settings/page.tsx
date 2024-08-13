import { Card } from 'antd'

type BotSettingsPageProps = {
  params: {
    cid: string
  }
}

const BotSettingsPage: React.FC<BotSettingsPageProps> = ({
  params,
}: {
  params: { cid: string }
}) => {
  return <Card title="Chatbot Settings"></Card>
}

export default BotSettingsPage
