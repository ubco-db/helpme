'use client'

import { organizationApi } from '@/app/api/organizationApi'
import { message, Alert, Button, Card, Form, Input, Select } from 'antd'
import Head from 'next/head'
import React, { SetStateAction, useEffect, useState } from 'react'
import { Organization } from '@/app/typings/organization'
import { LeftOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import Image from 'next/image'
import ReCAPTCHA from 'react-google-recaptcha'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [accountActiveResponse, setAccountActiveResponse] = useState(true)
  const [loginMenu, setLoginMenu] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const recaptchaRef = React.createRef<ReCAPTCHA>()

  useEffect(() => {
    async function getOrganizations() {
      const organizations = await organizationApi.getOrganizations()
      setOrganizations(organizations)
    }

    getOrganizations()
  }, [])

  const onPassChange = (e: { target: { value: SetStateAction<string> } }) => {
    setPassword(e.target.value)
  }

  const onUserNameChange = (e: {
    target: { value: SetStateAction<string> }
  }) => {
    setUsername(e.target.value)
  }

  const showLoginMenu = (value: number) => {
    const organization = organizations.find((org) => org.id === value)

    localStorage.setItem('organizationId', `${organization?.id}`)

    if (!organization) {
      message.error('Organization not found')
      return
    }

    setOrganization(organization)
    setLoginMenu(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async function login() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async function loginWithGoogle() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async function loginWithInstitution() {}

  async function onReCAPTCHAChange(captchaCode: string | null) {
    if (!captchaCode) return

    recaptchaRef?.current?.reset()
  }

  return (
    <>
      <Head>
        <title>Login | HelpMe</title>
      </Head>
      <div className="container mx-auto h-auto w-1/2 pt-20 text-center">
        <Card className="mx-auto max-w-md sm:px-2 md:px-6">
          <h2 className="my-4 text-left">Login</h2>

          {!loginMenu && (
            <div>
              <p className="text-left text-stone-400">
                Select your organization.
              </p>

              <Select
                className="mt-2 w-full text-left"
                placeholder="Available Organizations"
                options={organizations.map((organization) => {
                  return {
                    label: organization.name,
                    value: organization.id,
                  }
                })}
                onChange={(value) => {
                  showLoginMenu(value)
                }}
              />
            </div>
          )}

          {loginMenu && (
            <div>
              {organizations && organizations.length > 1 && (
                <Button
                  className="flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
                  onClick={() => setLoginMenu(false)}
                >
                  <LeftOutlined />
                  <span className="font-semibold"> Go Back</span>
                </Button>
              )}

              {organization && organization.googleAuthEnabled && (
                <Button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
                  onClick={() => loginWithGoogle()}
                >
                  <Image
                    className="h-6 w-6"
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    loading="lazy"
                    alt="google logo"
                    width={24}
                    height={24}
                  />
                  <span className="font-semibold">Log in with Google</span>
                </Button>
              )}

              {organization && organization.ssoEnabled && (
                <Button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
                  onClick={() => loginWithInstitution()}
                >
                  <span className="font-semibold">Log in with Institution</span>
                </Button>
              )}

              {organization && organization.legacyAuthEnabled && (
                <p className="my-5 font-medium uppercase text-stone-400">
                  Or login with email
                </p>
              )}

              {!accountActiveResponse && (
                <Alert
                  message="System Notice"
                  description="Your account has been deactivated. Please contact your organization admin for more information."
                  type="error"
                  style={{ marginBottom: 20, textAlign: 'left' }}
                />
              )}
              {organization && organization.legacyAuthEnabled && (
                <Form
                  name="normal_login"
                  className="login-form"
                  initialValues={{ remember: true }}
                  onFinish={login}
                >
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    size="invisible"
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''}
                    onChange={onReCAPTCHAChange}
                  />
                  <Form.Item
                    name="username"
                    rules={[
                      {
                        required: true,
                        message: 'Please enter a valid username.',
                      },
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined className="site-form-item-icon" />}
                      onChange={onUserNameChange}
                      className="rounded-lg border px-2 py-2"
                      placeholder="Username"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      {
                        required: true,
                        message: 'Please enter a valid password.',
                      },
                    ]}
                  >
                    <Input
                      prefix={<LockOutlined className="site-form-item-icon" />}
                      onChange={onPassChange}
                      type="password"
                      className="rounded-lg border px-2 py-2"
                      placeholder="Password"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      className="h-auto w-full items-center justify-center rounded-lg border px-2 py-2 "
                    >
                      <span className="font-semibold">Log in</span>
                    </Button>
                  </Form.Item>

                  <div className="d-flex flex-row space-x-8 text-center">
                    <a href="/account/password">Forgot password</a>
                    <a href="/register">Create account</a>
                  </div>
                </Form>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
