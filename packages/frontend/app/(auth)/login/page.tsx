'use client'

import { organizationApi } from '@/app/api/organizationApi'
import { message, Alert, Button, Card, Form, Input, Select } from 'antd'
import React, { SetStateAction, useCallback, useEffect, useState } from 'react'
import { Organization } from '@/app/typings/organization'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import Image from 'next/image'
import ReCAPTCHA from 'react-google-recaptcha'
import Link from 'next/link'
import { userApi } from '@/app/api/userApi'
import { useRouter } from 'next/navigation'
import { LoginData } from '@/app/typings/user'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useOrganizationProviderForInvitedCourse } from './components/OrganizationProviderForInvitedCourse'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountActiveResponse, setAccountActiveResponse] = useState(true)
  const [loginMenu, setLoginMenu] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const recaptchaRef = React.createRef<ReCAPTCHA>()
  const router = useRouter()
  const { organizationIdForInvitedCourse } =
    useOrganizationProviderForInvitedCourse()

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

  const onEmailChange = (e: { target: { value: SetStateAction<string> } }) => {
    setEmail(e.target.value)
  }

  const showLoginMenu = useCallback(
    (value: number) => {
      if (organizations.length > 0) {
        const organization = organizations.find((org) => org.id === value)
        localStorage.setItem('organizationId', `${organization?.id}`)
        if (!organization) {
          message.error('Organization not found')
          return
        }
        setOrganization(organization)
        setLoginMenu(true)
      }
    },
    [organizations],
  )

  const hideLoginMenu = useCallback(() => {
    localStorage.removeItem('organizationId')
    setOrganization(null)
    setLoginMenu(false)
  }, [])

  async function login() {
    const token = (await recaptchaRef?.current?.executeAsync()) ?? ''
    if (organization && !organization.legacyAuthEnabled) {
      message.error('Organization does not support legacy authentication')
      return
    }
    const loginData: LoginData = {
      email,
      password,
      recaptchaToken: token,
    }
    await userApi.login(loginData).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        const error = (data && data.message) || response.statusText
        switch (response.status) {
          case 401:
            message.error(data.message)
            break
          case 403:
            setAccountActiveResponse(false)
            break
          case 404:
            message.error('User Not Found')
            break
          default:
            message.error(error)
            break
        }
        return Promise.reject(error)
      } else {
        router.push(`/api/v1/login/entry?token=${data.token}`)
      }
    })
  }

  async function loginWithGoogle() {
    const response = await userApi.loginWithGoogle(organization?.id ?? -1)
    const data = await response.json()
    if (response.status !== 200) {
      message.error(data.message)
      return
    }
    router.push(data.redirectUri)
  }

  async function loginWithInstitution() {
    router.push(`/api/v1/auth/link/sso/${organization?.id}`)
  }

  async function onReCAPTCHAChange(captchaCode: string | null) {
    if (!captchaCode) return
    recaptchaRef?.current?.reset()
  }

  useEffect(() => {
    async function smartlySetOrganization() {
      // if (organizations.length === 1) {
      //   showLoginMenu(organizations[0].id)
      // }
      // get courseId from SECURE_REDIRECT (from invite code) and get the course's organization, and then set the organization to that
      if (organizationIdForInvitedCourse) {
        showLoginMenu(organizationIdForInvitedCourse)
      }
    }
    smartlySetOrganization()
  }, [organizations, showLoginMenu])

  if (organizations.length === 0) {
    return (
      <main>
        <CenteredSpinner tip="Loading Organizations..." />
      </main>
    )
  } else {
    return (
      <main>
        <title>Helpme | Login</title>
        <div className="container mx-auto h-auto w-full pt-20 text-center md:w-1/2">
          {loginMenu && (
            <Button type="link" className="mr-96" onClick={hideLoginMenu}>
              &lt; Back
            </Button>
          )}
          <Card className="mx-auto max-w-md sm:px-2 md:px-6">
            <h2 className="mb-4 text-left">Login</h2>

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
                {organization && organization.ssoEnabled && (
                  <Button
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
                    onClick={() => loginWithInstitution()}
                  >
                    {organization.logoUrl && (
                      <Image
                        src={organization.logoUrl}
                        className="h-6 w-6"
                        loading="lazy"
                        alt="google logo"
                        width={24}
                        height={24}
                      />
                    )}
                    <span className="font-semibold">
                      Log in with Institution
                    </span>
                  </Button>
                )}
                {organization && organization.googleAuthEnabled && (
                  <Button
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
                    onClick={() => loginWithGoogle()}
                  >
                    <Image
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      className="h-6 w-6"
                      loading="lazy"
                      alt="google logo"
                      width={24}
                      height={24}
                    />
                    <span className="font-semibold">Log in with Google</span>
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
                      sitekey={
                        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ??
                        'nokeyprovided'
                      }
                      onChange={onReCAPTCHAChange}
                    />
                    <Form.Item
                      name="email"
                      rules={[
                        {
                          required: true,
                          message: 'Please enter a valid email.',
                        },
                      ]}
                    >
                      <Input
                        prefix={
                          <UserOutlined className="site-form-item-icon" />
                        }
                        onChange={onEmailChange}
                        className="rounded-lg border px-2 py-2"
                        placeholder="Email"
                        autoComplete="email"
                        type="email"
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
                        prefix={
                          <LockOutlined className="site-form-item-icon" />
                        }
                        onChange={onPassChange}
                        type="password"
                        autoComplete="current-password"
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
                      <Link href="/password">Forgot password</Link>
                      <Link href="/register">Create account</Link>
                    </div>
                  </Form>
                )}
              </div>
            )}
          </Card>
        </div>
      </main>
    )
  }
}
