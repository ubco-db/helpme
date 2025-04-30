'use client'

import { Button, Card, Form, Input, message, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { Result } from 'antd'
import { useEffect, useState, use } from 'react'
import { authApi } from '@/app/api/authApi'
import { PasswordConfirmationData } from '@/app/typings/user'

const PasswordResetPage = (props: { params: Promise<{ token: string }> }) => {
  const params = use(props.params)
  const router = useRouter()
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [invalidTokenMessage, setInvalidTokenMessage] = useState(null)
  const [resetPasswordForm] = Form.useForm()

  useEffect(() => {
    const fetchToken = async () => {
      const response = await fetch(
        `/api/v1/auth/password/reset/validate/${params.token}`,
      )

      if (response.ok) {
        setIsTokenValid(true)
      } else {
        const data = await response.json()

        setInvalidTokenMessage(data.message)
      }
    }

    fetchToken()
  }, [params.token])

  const resetPassword = async () => {
    const formValues = await resetPasswordForm.validateFields()
    const { passwordField, confirmPasswordField } = formValues

    if (passwordField !== confirmPasswordField) {
      message.error('Passwords do not match')
      return
    }

    const passwordConfirmationPayloadData: PasswordConfirmationData = {
      password: passwordField,
      confirmPassword: confirmPasswordField,
    }

    const response = await authApi.resetPassword(
      params.token,
      passwordConfirmationPayloadData,
    )

    const data = await response.json()

    if (!response.ok) {
      const error = (data && data.message) || response.statusText
      message.error(error)
      return Promise.reject(error)
    } else {
      message.success('Password reset successfully')
      router.push('/login')
    }
  }

  if (isTokenValid) {
    return (
      <div className="mx-auto mt-40 flex items-center justify-center md:w-4/5 lg:w-4/5 2xl:w-3/5">
        <Card className="md:w-4/5 lg:w-2/5 2xl:w-3/5">
          <h1>Reset your password</h1>
          <p>You are almost done! Enter your new password below.</p>
          <Form
            className="mx-auto mt-5 w-full"
            form={resetPasswordForm}
            onFinish={resetPassword}
          >
            <Form.Item
              name="passwordField"
              rules={[
                {
                  required: true,
                  message: 'Please input your password',
                },
                {
                  min: 6,
                  message: 'Password must be at least 6 characters',
                },
                {
                  max: 20,
                  message: 'Password must be at most 20 characters',
                },
              ]}
            >
              <Input
                type="password"
                placeholder="Your new password"
                className="text-1xl p-2 text-center"
              />
            </Form.Item>

            <Form.Item
              name="confirmPasswordField"
              rules={[
                {
                  required: true,
                  message: 'Please confirm your password',
                },
                {
                  min: 6,
                  message: 'Password must be at least 6 characters',
                },
                {
                  max: 20,
                  message: 'Password must be at most 20 characters',
                },
              ]}
            >
              <Input
                type="password"
                placeholder="Your new password again"
                className="text-1xl p-2 text-center"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              className="mt-3 h-auto w-full items-center justify-center border px-2 py-2"
            >
              <span>Reset Password</span>
            </Button>
          </Form>
        </Card>
      </div>
    )
  } else if (!isTokenValid && invalidTokenMessage !== null) {
    return (
      <div className="rounded text-center">
        <Result
          status="error"
          title={invalidTokenMessage}
          extra={[
            <Button
              type="primary"
              className="h-auto items-center justify-center rounded-lg border px-5 py-3"
              key="login"
              onClick={() => router.push('/login')}
            >
              Go to Login Page
            </Button>,
          ]}
        />
      </div>
    )
  } else {
    return <Spin />
  }
}

export default PasswordResetPage
