import React, { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { Button, Form, Switch } from 'antd'
import useSWR from 'swr'

const EmailNotifications: React.FC = () => {
  const { data: profile, mutate } = useSWR('api/v1/profile', async () =>
    API.profile.index(),
  )
  const [form] = Form.useForm()
  const [subscriptions, setSubscriptions] = useState<
    { id: any; name: any; isSubscribed: any }[]
  >([])

  useEffect(() => {
    API.emailNotification.get().then((data) => {
      console.log(data)
      const formattedData = data.map((notif: any) => ({
        id: notif.id,
        name: notif.name,
        isSubscribed: notif.isSubscribed,
      }))
      setSubscriptions(formattedData)

      // Set initial values for the form
      const initialValues: { [key: string]: boolean } = formattedData.reduce<{
        [key: string]: boolean
      }>((acc, sub) => {
        acc[sub.id] = sub.isSubscribed
        return acc
      }, {})
      form.setFieldsValue(initialValues)
    })
  }, [form])

  const handleOk = async () => {
    try {
      const values = form.getFieldsValue()
      console.log('values', values)
      // Convert form values back to the expected format
      const updatedSubscriptions = subscriptions.map((sub) => ({
        ...sub,
        isSubscribed: values[sub.id],
      }))
      // await API.emailNotification.update(updatedSubscriptions);
      // mutate(); // Re-fetch profile data after saving
    } catch (error) {
      console.error('Failed to save notification settings:', error)
    }
  }

  return (
    <div>
      <Form form={form} layout="vertical">
        {subscriptions.map((subscription) => (
          <Form.Item
            key={subscription.id}
            label={`Enable ${subscription.name}`}
            name={subscription.id}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        ))}
      </Form>
      <Button
        key="submit"
        type="primary"
        onClick={handleOk}
        style={{ marginTop: '30px', marginBottom: '15px' }}
      >
        Save
      </Button>
    </div>
  )
}

export default EmailNotifications
