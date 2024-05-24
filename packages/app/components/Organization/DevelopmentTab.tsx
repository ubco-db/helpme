import { Button, Card, message } from 'antd'
import { ReactElement } from 'react'

export default function DevelopmentTab({
  organizationId,
}: {
  organizationId: number
}): ReactElement {
  const populateTable = async () => {
    const response = await fetch(
      `/api/v1/organization/${organizationId}/populate_chat_token_table`,
      {
        method: 'POST',
      },
    )

    const json = await response.json()

    if (response.ok) {
      message.success(json.message)
    } else {
      message.error(json.message)
    }
  }

  return (
    <>
      <Card title="Development Tool" className="mt-2">
        <div className="flex items-center gap-4">
          <p className="font-bold">Populate Chat Token Table</p>
          <Button type="primary" onClick={populateTable}>
            Populate
          </Button>
        </div>
      </Card>
    </>
  )
}
