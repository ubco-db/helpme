'use client'

import { Button, Card, Form, Input, message, Result, Spin } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { use, useEffect, useMemo, useState } from 'react'
import { PasswordRequestResetWithTokenBody } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const PasswordResetPage = (props: { params: Promise<{ token: string }> }) => {
  const params = use(props.params)
  const router = useRouter()
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [invalidTokenMessage, setInvalidTokenMessage] = useState(null)
  const [resetPasswordForm] = Form.useForm()
  const pathName = usePathname()

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  useEffect(() => {
    const validateToken = async () => {
      await API.auth
        .validateResetToken(params.token)
        .then(() => setIsTokenValid(true))
        .catch((err) => {
          setIsTokenValid(false)
          setInvalidTokenMessage(getErrorMessage(err))
        })
    }
    validateToken()
  }, [params.token])

  const resetPassword = async () => {
    const formValues = await resetPasswordForm.validateFields()
    const { passwordField, confirmPasswordField } = formValues

    if (passwordField !== confirmPasswordField) {
      message.error('Passwords do not match')
      return
    }

    const passwordConfirmationPayloadData: PasswordRequestResetWithTokenBody = {
      password: passwordField,
      confirmPassword: confirmPasswordField,
    }

    return await API.auth
      .resetPassword(params.token, passwordConfirmationPayloadData)
      .then(() => {
        message.success('Password reset successfully')
        router.push(isLti ? '/lti/login' : '/login')
      })
      .catch((err) => {
        const error = getErrorMessage(err)
        message.error(error)
      })
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
              onClick={() => router.push(isLti ? '/lti/login' : '/login')}
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
