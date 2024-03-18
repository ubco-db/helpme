import React, { ReactElement, useEffect, useState } from 'react'
import Head from 'next/head'
import { Button, Card, Form, Input, message } from 'antd'
import { StandardPageContainer } from '../../components/common/PageContainer'
import ReCAPTCHA from 'react-google-recaptcha'

export default function ForgetPassword(): ReactElement {
  const [organizationId, setOrganizationId] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    setOrganizationId(parseInt(localStorage.getItem('organizationId')))
  }, [organizationId])

  const recaptchaRef = React.createRef()

  const onReCAPTCHAChange = (captchaCode) => {
    if (!captchaCode) {
      return
    }

    recaptchaRef.current.reset()
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

    const token = await recaptchaRef.current.executeAsync()

    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailField,
        recaptchaToken: token,
        organizationId,
      }),
    }

    fetch('/api/v1/auth/password/reset', request).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        const error = (data && data.message) || response.statusText
        message.error(error)
        return Promise.reject(error)
      } else {
        message.success('Password reset email sent.')
      }
    })
  }

  return (
    <>
      <StandardPageContainer>
        <Head>
          <title>Reset Password | HelpMe</title>
        </Head>
        <div className="mx-auto mt-40 flex items-center justify-center md:w-4/5 lg:w-2/5 2xl:w-3/5">
          <Card>
            <h1>Reset your password</h1>
            <p className="mt-4">
              Enter your email address and we will send you instructions on how
              to reset your password.
            </p>
            <Form
              className="mx-auto mt-5 md:w-3/5 lg:w-4/5 2xl:w-3/5"
              form={form}
              onFinish={sendResetPasswordEmail}
            >
              <ReCAPTCHA
                ref={recaptchaRef}
                size="invisible"
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
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
              <a href="/login">Go Back</a>
            </div>
          </Card>
        </div>
      </StandardPageContainer>
    </>
  )
}
