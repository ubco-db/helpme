'use client'

import { Button, Card, Form, Input, message, Spin } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { API } from '@/app/api'
import { usePathname } from 'next/navigation'
import { getErrorMessage } from '@/app/utils/generalUtils'

export default function ForgetPassword() {
  const [organizationId, setOrganizationId] = useState(0)
  const [form] = Form.useForm()
  const [domLoaded, setDomLoaded] = useState(false)
  const pathName = usePathname()

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  useEffect(() => {
    setOrganizationId(parseInt(localStorage.getItem('organizationId') ?? ''))
    setDomLoaded(true)
  }, [organizationId])

  const recaptchaRef = React.createRef<ReCAPTCHA>()

  const onReCAPTCHAChange = (captchaCode: string | null) => {
    if (!captchaCode) {
      return
    }

    recaptchaRef?.current?.reset()
  }

  const sendResetPasswordEmail = async () => {
    const formValues = await form.validateFields()

    const { emailField } = formValues

    if (isNaN(organizationId) || organizationId < 1) {
      message.error('Organization not found.')
      return
    }

    if (emailField.trim().length < 1) {
      message.error('Email must be at least 1 character')
      return
    }

    const token = await recaptchaRef?.current?.executeAsync()

    const params = {
      email: emailField,
      recaptchaToken: token ?? '',
      organizationId,
    }

    return await (
      isLti
        ? API.lti.auth.requestPasswordReset(params)
        : API.auth.requestPasswordReset(params)
    )
      .then(() => {
        message.success('Password reset email sent.')
      })
      .catch((err) => {
        message.error(getErrorMessage(err))
      })
  }

  return domLoaded ? (
    <div className="mx-auto mt-40 flex items-center justify-center md:w-4/5 lg:w-2/5 2xl:w-3/5">
      <Card>
        <h1>Reset your password</h1>
        <p className="mt-4">
          Enter your email address and we will send you instructions on how to
          reset your password.
        </p>
        <Form
          className="mx-auto mt-5 md:w-3/5 lg:w-4/5 2xl:w-3/5"
          form={form}
          onFinish={sendResetPasswordEmail}
        >
          {/* @ts-expect-error Server Component */}
          <ReCAPTCHA
            ref={recaptchaRef}
            size="invisible"
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''}
            onChange={onReCAPTCHAChange}
          />
          <Form.Item
            name="emailField"
            rules={[
              {
                required: true,
                message: 'Please input your email address',
              },
            ]}
          >
            <Input
              type="email"
              placeholder=""
              className="text-1xl p-2 text-center"
              autoComplete="email"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            className="mt-3 h-auto w-full items-center justify-center border px-2 py-2"
          >
            <span>Send Reset Link</span>
          </Button>
        </Form>
        <div className="mt-4 text-center">
          <a href={isLti ? '/lti/login' : '/login'}>Go Back</a>
        </div>
      </Card>
    </div>
  ) : (
    <Spin />
  )
}
