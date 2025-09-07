'use client'

import StandardPageContainer from '@/app/components/standardPageContainer'
import { User } from '@koh/common'
import { Button, Card, Form, Input, message, Spin } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { API, fetchUserDetails } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

export default function VerifyEmailPage() {
  const [form] = Form.useForm()
  const router = useRouter()
  const pathName = usePathname()
  const [profile, setProfile] = useState<User>()

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  useEffect(() => {
    fetchUserDetails(setProfile)
  }, [])

  const resendVerificationCode = async () => {
    const response = await API.mail.resendVerificationCode()
    const data = response.data

    if (!(response.status >= 200 && response.status < 300)) {
      const error = getErrorMessage(data)
      message.error(error)
      return
    }
    message.success('Verification code has been resent.')
  }

  const validateVerificationCode = async () => {
    const formValues: { verificationCode: string } = await form.validateFields()
    const verificationCode = formValues.verificationCode.toUpperCase()

    const response = await (isLti
      ? API.lti.auth.verifyEmail(verificationCode)
      : API.auth.verifyEmail(verificationCode))

    const data = response.data

    if (response.status == 307 || response.status == 302) {
      router.push(data.redirectUri)
      return
    }

    if (!(response.status >= 200 && response.status < 300)) {
      message.error(getErrorMessage(response.data))
      return
    }

    router.push(isLti ? '/lti' : '/courses')
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
              <a href={'/api/v1/logout'}>Logout</a>
            </div>
          </Form>
        </Card>
      </div>
    </StandardPageContainer>
  ) : (
    <Spin />
  )
}
