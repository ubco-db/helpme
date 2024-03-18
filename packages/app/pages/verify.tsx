import Head from 'next/head'
import React, { ReactElement, useEffect } from 'react'
import { StandardPageContainer } from '../components/common/PageContainer'
import { useProfile } from '../hooks/useProfile'
import { Button, Card, Form, Input, Spin, message } from 'antd'
import Router from 'next/router'

export default function Verify(): ReactElement {
  const profile = useProfile()

  const [form] = Form.useForm()

  useEffect(() => {
    if (profile?.emailVerified) {
      window.location.href = '/courses'
    } else if (!profile) {
      window.location.href = '/login'
    }
  })

  const validateVerificationCode = async () => {
    const formValues = await form.validateFields()
    const { verificationCode } = formValues

    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: verificationCode,
      }),
    }
    fetch('api/v1/auth/registration/verify', request).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        const error = (data && data.message) || response.statusText
        message.error(error)
        return Promise.reject(error)
      } else {
        window.location.href = '/courses'
      }
    })
  }

  const resendVerificationCode = async () => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
    fetch('api/v1/mail/registration/resend', request).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        const error = (data && data.message) || response.statusText
        message.error(error)
        return Promise.reject(error)
      } else {
        message.success('Verification code has been resent.')
      }
    })
  }

  return profile ? (
    <StandardPageContainer>
      <Head>
        <title>Verify Email Address</title>
      </Head>
      <div className="mx-auto mt-40 flex items-center justify-center md:w-4/5 lg:w-2/5 2xl:w-3/5">
        <Card>
          <h1>Verify your email address</h1>
          <p className="mt-4">
            We have sent a verification email to{' '}
            <strong>{profile.email}</strong>. Please check your email and enter
            the verification code below.
          </p>
          <Form
            className="mx-auto mt-5 md:w-3/5 lg:w-4/5 2xl:w-3/5"
            form={form}
            onFinish={validateVerificationCode}
          >
            <Form.Item
              name="verificationCode"
              rules={[
                {
                  required: true,
                  message: 'Please input your verification code',
                },
                {
                  min: 8,
                  message: 'Verification code must be at least 8 characters',
                },
                {
                  max: 8,
                  message: 'Verification code must be at most 8 characters',
                },
              ]}
            >
              <Input
                type="text"
                placeholder="A2C1E0ED"
                maxLength={8}
                className="fs-5 p-5 text-center text-2xl uppercase tracking-[.50em] caret-transparent"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              className="mt-3 h-auto w-full items-center justify-center border px-2 py-2"
            >
              <span>Confirm Email Address</span>
            </Button>

            <Button
              type="primary"
              className="mt-3 h-auto w-full items-center justify-center border px-2 py-2"
              onClick={resendVerificationCode}
            >
              <span>Re-send Confirmation Code</span>
            </Button>

            <div className="mt-4 text-center">
              <a href="/api/v1/logout">Logout</a>
            </div>
          </Form>
        </Card>
      </div>
    </StandardPageContainer>
  ) : (
    <Spin />
  )
}
