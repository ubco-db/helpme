import React, { ReactElement, useEffect, useState } from 'react'
import Head from 'next/head'
import {
  Button,
  Card,
  Form,
  Input,
  Spin,
  message,
  Typography,
  Result,
} from 'antd'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import { useRouter } from 'next/router'
import styled from 'styled-components'

export default function ForgetPasswordReset(): ReactElement {
  const router = useRouter()
  const { token } = router.query
  const [isTokenValid, setIsTokenValid] = useState(null)
  const [invalidTokenMessage, setInvalidTokenMessage] = useState(null)
  const [resetPasswordForm] = Form.useForm()

  const Container = styled.div`
    margin-left: auto;
    margin-right: auto;
    text-align: center;
    padding-top: 100px;
    width: 60%;
    border-radius: 15px;
    height: auto;

    @media (max-width: 650px) {
      width: 90%;
    }

    @media (max-width: 992px) {
      width: 80%;
    }
  `

  useEffect(() => {
    fetch(`/api/v1/auth/password/reset/validate/${token}`).then(
      async (response) => {
        if (response.ok) {
          setIsTokenValid(true)
        } else {
          const data = await response.json()

          setInvalidTokenMessage(data.message)
        }
      },
    )
  })

  function ResponseContainer(): ReactElement {
    const resetPassword = async () => {
      const formValues = await resetPasswordForm.validateFields()
      const { passwordField, confirmPasswordField } = formValues

      if (passwordField !== confirmPasswordField) {
        message.error('Passwords do not match')
        return
      }

      const request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passwordField,
          confirmPassword: confirmPasswordField,
        }),
      }

      fetch(`/api/v1/auth/password/reset/${token}`, request).then(
        async (response) => {
          const data = await response.json()
          if (!response.ok) {
            const error = (data && data.message) || response.statusText
            message.error(error)
            return Promise.reject(error)
          } else {
            message.success('Password reset successful').then(() => {
              setTimeout(() => {
                window.location.href = '/login'
              }, 1750)
            })
          }
        },
      )
    }

    if (isTokenValid) {
      if (!isTokenValid && invalidTokenMessage !== null) {
        return (
          <Container>
            <Result
              status="error"
              title={invalidTokenMessage}
              extra={[
                <Button
                  type="primary"
                  className="m-auto h-auto w-2/5 items-center justify-center rounded-lg border px-5 py-3"
                  key="login"
                  onClick={() => router.push('/login')}
                >
                  Go to Login Page
                </Button>,
              ]}
            />
          </Container>
        )
      } else {
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
      }
    } else {
      return <Spin />
    }
  }

  return (
    <StandardPageContainer>
      <Head>
        <title>Reset Password | HelpMe</title>
      </Head>

      <ResponseContainer />
    </StandardPageContainer>
  )
}
