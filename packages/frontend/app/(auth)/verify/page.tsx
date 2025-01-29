'use client'

import { authApi } from '@/app/api/authApi'
import { mailApi } from '@/app/api/mailApi'
import { userApi } from '@/app/api/userApi'
import StandardPageContainer from '@/app/components/standardPageContainer'
import { User } from '@koh/common'
import { Button, Card, Form, Input, message, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function VerifyEmailPage() {
  const [form] = Form.useForm()
  const router = useRouter()
  const [profile, setProfile] = useState<User>()

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()

      setProfile(response)
    }

    fetchUserDetails()
  }, [])

  const resendVerificationCode = async () => {
    const response = await mailApi.resendVerificationCode()
    const data = await response.json()

    if (!response.ok) {
      const error = (data && data.message) || response.statusText
      message.error(error)
      return Promise.reject(error)
    } else {
      message.success('Verification code has been resent.')
    }
  }

  const validateVerificationCode = async () => {
    const formValues: { verificationCode: string } = await form.validateFields()
    const verificationCode = formValues.verificationCode.toUpperCase()

    const response = await authApi.verifyEmail(verificationCode)

    const data = await response.json()

    if (response.status == 307) {
      router.push(data.redirectUri)
      return
    }

    if (!response.ok) {
      const error = (data && data.message) || response.statusText
      message.error(error)
      return Promise.reject(error)
    } else {
      router.push('/courses')
    }
  }

  return profile ? (
    <StandardPageContainer>
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
