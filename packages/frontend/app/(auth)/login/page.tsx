'use client'

import { organizationApi } from '@/app/api/organizationApi'
import { Alert, Button, Card, Form, Input, message, Select } from 'antd'
import React, { SetStateAction, useEffect, useMemo, useState } from 'react'
import { Organization } from '@/app/typings/organization'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import Image from 'next/image'
import ReCAPTCHA from 'react-google-recaptcha'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LoginData } from '@/app/typings/user'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useLoginRedirectInfoProvider } from './components/LoginRedirectInfoProvider'
import { isProd } from '@koh/common'
import { cn } from '@/app/utils/generalUtils'
import * as Sentry from '@sentry/nextjs'
import { API } from '@/app/api'
import { useLocalStorage } from '@/app/hooks/useLocalStorage'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountActiveResponse, setAccountActiveResponse] = useState(true)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [storedId, setStoredId] = useLocalStorage<string>(
    'organizationId',
    null,
  )
  const [hasRetrievedOrganizations, setHasRetrievedOrganizations] =
    useState(false)

  const recaptchaRef = React.createRef<ReCAPTCHA>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathName = usePathname()

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  const error = searchParams.get('error')
  const [errorGettingOrgs, setErrorGettingOrgs] = useState(false)
  const redirect = searchParams.get('redirect')

  const { invitedOrgId, invitedQueueId } = useLoginRedirectInfoProvider()

  useEffect(() => {
    async function getOrganizations() {
      try {
        const organizations = await organizationApi.getOrganizations()
        setOrganizations(organizations)
        setHasRetrievedOrganizations(true)
      } catch (error: any) {
        message.error(error)
        setErrorGettingOrgs(true)
        return
      }
    }
    getOrganizations()
  }, [])

  const onPassChange = (e: { target: { value: SetStateAction<string> } }) => {
    setPassword(e.target.value)
  }

  const onEmailChange = (e: { target: { value: SetStateAction<string> } }) => {
    setEmail(e.target.value)
  }

  // capture error from the query params in sentry
  useEffect(() => {
    if (error) {
      if (error === 'sessionExpired') {
        Sentry.captureEvent({
          message: 'Session Expired',
          level: 'info',
        })
      } else {
        Sentry.captureException(error)
      }
    }
  }, [error])

  const selectOrganization = (value: number) => {
    if (organizations.length > 0) {
      const organization = organizations.find((org) => org.id === value)
      setStoredId(`${organization?.id}`)
      if (!organization) {
        message.error('Organization not found')
        return
      }
      setOrganization(organization)
    }
  }

  async function login() {
    let loginData: LoginData
    if (isProd()) {
      const token = (await recaptchaRef?.current?.executeAsync()) ?? ''
      if (organization && !organization.legacyAuthEnabled) {
        message.error(
          'Organization does not support login with username/password',
        )
        return
      }
      loginData = {
        email,
        password,
        recaptchaToken: token,
      }
    } else {
      loginData = {
        email,
        password,
        recaptchaToken: '',
      }
    }

    const response = await API.login.index(loginData)
    const data = await response.data
    if (!(response.status >= 200 && response.status < 300)) {
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
        case 429:
          message.error('Too many requests. Please try again after 1min')
          break
        default:
          message.error(error)
          break
      }
      return
    } else {
      const params = new URLSearchParams({
        token: data.token,
      })
      if (redirect) {
        params.append('redirect', redirect)
      }
      router.push(`/api/v1/login/entry?${params.toString()}`)
    }
  }

  async function loginWithGoogle() {
    const id = organization?.id ?? -1
    const response = await (isLti
      ? API.lti.auth.loginWithGoogle(id)
      : API.auth.loginWithGoogle(id))

    if (response.headers['content-type']?.includes('application/json')) {
      const data = response.data
      if (response.status !== 200) {
        message.error(data.message)
        Sentry.captureEvent({
          message: `Error with loginWithGoogle ${response.status}: ${response.statusText}`,
          level: 'error',
          extra: {
            text: data.message,
            data,
            response,
          },
        })
        return
      }
      router.push(data.redirectUri)
    } else {
      const text = response.data as string
      Sentry.captureEvent({
        message: `Error with loginWithGoogle ${response.status}: ${response.statusText}`,
        level: 'error',
        extra: {
          text,
          response,
        },
      })
      message.error(text)
    }
  }

  async function onReCAPTCHAChange(captchaCode: string | null) {
    if (!captchaCode) return
    recaptchaRef?.current?.reset()
  }

  useEffect(() => {
    async function smartlySetOrganization() {
      let id: number = organizations[0]?.id

      // get courseId from SECURE_REDIRECT (from invite code) and get the course's organization, and then set the organization to that
      if (invitedOrgId) {
        id = invitedOrgId
      } else {
        const orgId = parseInt(String(storedId))
        if (!isNaN(orgId)) {
          id = orgId
        }
      }

      if (organization?.id == id) return
      selectOrganization(id)
    }
    smartlySetOrganization()
  }, [invitedOrgId, organizations, storedId])

  useEffect(() => {
    const orgId = parseInt(String(storedId))
    if (!isNaN(orgId)) {
      selectOrganization(orgId)
    }
  }, [storedId])

  if (errorGettingOrgs) {
    return (
      <main>
        <title>HelpMe | Error</title>
        <div className="container mx-auto h-auto w-full pt-10 text-center">
          <Alert
            message="Error"
            description="There was an error getting the organizations. Please refresh the page or try again later."
            type="error"
          />
        </div>
      </main>
    )
  } else if (organizations.length === 0 || !organizations) {
    return (
      <main>
        {hasRetrievedOrganizations ? (
          <Alert
            message="No Organizations"
            description="There are no registered organizations."
            type="error"
          />
        ) : (
          <CenteredSpinner tip="Loading Organizations..." />
        )}
      </main>
    )
  } else {
    return (
      <main>
        <title>HelpMe | Login</title>
        {invitedQueueId && (
          <div className="container mx-auto h-auto w-full max-w-lg pt-10 text-center">
            <Alert
              message={
                'You have been invited to join a queue! Please login to continue.'
              }
              type="success"
            />
          </div>
        )}
        {error && (
          <div className="container mx-auto h-auto w-full pt-10 text-center md:w-1/2">
            <Alert
              message="Error"
              description={
                error === 'redirect'
                  ? 'There was an error during a redirection. Please refresh the page or login again.'
                  : error === 'sessionExpired'
                    ? 'Your session has expired. Please login again.'
                    : `An unknown error has occurred (${error}). Please try again.`
              }
              type="error"
            />
          </div>
        )}
        <div
          className={cn(
            'container mx-auto h-auto w-full text-center md:w-1/2',
            invitedQueueId || error ? 'pt-5' : 'pt-20',
          )}
        >
          <Card className="mx-auto max-w-md sm:px-2 md:px-6">
            <h2 className="mb-4 text-left">Login</h2>
            <div>
              <div>
                <p className="text-left text-stone-400">
                  Select your organization.
                </p>
                <Select
                  className="mt-2 w-full text-left"
                  placeholder="Available Organizations"
                  defaultValue={organizations?.[0].id}
                  options={organizations.map((organization) => {
                    return {
                      label: organization.name,
                      value: organization.id,
                    }
                  })}
                  value={organization?.id}
                  onChange={(value) => {
                    selectOrganization(value)
                  }}
                />
              </div>
              {organization && organization.ssoEnabled && (
                <Link
                  href={(isLti ? API.lti : API).auth.shibboleth(
                    organization.id,
                  )}
                  prefetch={false}
                >
                  <Button className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left">
                    {organization.logoUrl && (
                      <Image
                        src={`/api/v1/organization/${organization.id}/get_logo/${organization.logoUrl}`}
                        loading="lazy"
                        alt="Org Logo"
                        width={24}
                        height={24}
                      />
                    )}
                    <div className="flex flex-col items-center justify-center">
                      <div className="font-semibold">
                        Continue with {organization.name}
                      </div>
                      <div className="text-xs text-green-400">
                        (recommended)
                      </div>
                    </div>
                  </Button>
                </Link>
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
                  <div className="flex flex-col items-center justify-center">
                    <div className="font-semibold">Continue with Google</div>
                    {!organization.ssoEnabled && (
                      <div className="text-xs text-green-400">
                        (recommended)
                      </div>
                    )}
                  </div>
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
                  {/*
                    In some environments, components which return Promises or arrays do not work.
                    This is due to some changes to react and @types/react, and the component
                    packages have not been updated to fix these issues.
                  */}
                  {/* @ts-expect-error Server Component */}
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
                      prefix={<UserOutlined className="site-form-item-icon" />}
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
                      prefix={<LockOutlined className="site-form-item-icon" />}
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
                    <Link href={isLti ? '/lti/password' : '/password'}>
                      <Button type="link">Forgot password</Button>
                    </Link>
                    <Link href={isLti ? '/lti/register' : '/password'}>
                      <Button type="link">Create account</Button>
                    </Link>
                  </div>
                </Form>
              )}
            </div>
          </Card>
        </div>
      </main>
    )
  }
}
