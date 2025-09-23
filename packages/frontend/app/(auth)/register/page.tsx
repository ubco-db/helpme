'use client'

import { Button, Card, Col, Form, Input, message, Row } from 'antd'
import React, { ReactElement, useEffect, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { LeftOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { userApi } from '@/app/api/userApi'
import Link from 'next/link'

interface Organization {
  id: number
  name: string
  ssoEnabled: boolean
  ssoEmailPatterns?: string[]
}

export default function RegisterPage(): ReactElement {
  const [organizationId, setOrganizationId] = useState(0)
  const [domLoaded, setDomLoaded] = useState(false)
  const router = useRouter()

  const [registerForm] = Form.useForm()
  const recaptchaRef = React.createRef<ReCAPTCHA>()

  async function onReCAPTCHAChange(captchaCode: string | null) {
    if (!captchaCode) return

    recaptchaRef?.current?.reset()
  }
  async function createAccount() {
    if (!organizationId) {
      message.error('Organization not found.')
      return
    }

    const { firstName, lastName, email, password, confirmPassword, sid } =
      await registerForm.validateFields()

    const token = await recaptchaRef?.current?.executeAsync()

    const response = await userApi.registerAccount({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      sid,
      organizationId,
      recaptchaToken: token ?? '',
    })

    if (response.status !== 201) {
      const data = await response.json()
      message.error(data.message)
    } else {
      localStorage.removeItem('organizationId')
      router.push('/courses')
    }
  }

  // Fetch all organizations for SSO settings
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const organization =
    organizations.find((o) => o.id === organizationId) || null
  async function fetchOrganizations() {
    try {
      const response = await fetch('/api/v1/organization')
      if (response.ok) {
        const orgs = await response.json()
        setOrganizations(orgs)
      } else {
        setOrganizations([])
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
      setOrganizations([])
    }
  }

  // Check if email matches SSO patterns for the current organization
  function checkSsoEmailPatterns(email: string): ReactElement | null {
    if (
      !organization ||
      !organization.ssoEnabled ||
      !organization.ssoEmailPatterns
    ) {
      return null
    }
    const errorMessage = (
      <span>
        SSO email detected! Would you like to{' '}
        <Link
          href={`/api/v1/auth/shibboleth/${organization.id}`}
          prefetch={false}
        >
          Continue with {organization.name}
        </Link>{' '}
        instead?
      </span>
    )
    const patterns = organization.ssoEmailPatterns ?? []
    for (const pattern of patterns) {
      if (pattern.startsWith('r')) {
        try {
          const regexPattern = pattern.substring(1)
          const regex = new RegExp(regexPattern)
          if (regex.test(email)) {
            return errorMessage
          }
        } catch (_error) {
          console.warn(`Invalid regex pattern: ${pattern}`)
        }
      } else {
        if (email.includes(pattern)) {
          return errorMessage
        }
      }
    }
    return null
  }

  useEffect(() => {
    setDomLoaded(true)
    const orgId = parseInt(localStorage.getItem('organizationId') ?? '')
    setOrganizationId(orgId)
    if (orgId) {
      fetchOrganizations()
    }
  }, [])

  return (
    <div>
      {domLoaded && (
        <div className="mx-auto h-auto pt-20 text-center lg:container lg:mx-auto">
          <Card className="mx-auto max-w-lg sm:px-2 md:px-6">
            <h2 className="my-4 flex items-center text-left">
              Create new account
            </h2>
            <Button
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-5 text-left"
              onClick={() => window.history.back()}
            >
              <LeftOutlined />
              <span className="font-semibold"> Go Back</span>
            </Button>

            <Form
              name="register"
              className="register-form mt-4"
              layout="vertical"
              form={registerForm}
              initialValues={{ remember: true }}
              onFinish={createAccount}
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
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''}
                onChange={onReCAPTCHAChange}
              />

              <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                  <Form.Item
                    label="First Name"
                    name="firstName"
                    rules={[
                      {
                        required: true,
                        message: 'Please input your first name',
                      },
                      {
                        min: 1,
                        message: 'First name must be at least 1 character',
                      },
                      {
                        max: 32,
                        message: 'First name must be at most 32 characters',
                      },
                    ]}
                  >
                    <Input allowClear={true} />
                  </Form.Item>
                </Col>

                <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                  <Form.Item
                    label="Last Name"
                    name="lastName"
                    rules={[
                      {
                        required: true,
                        message: 'Please input your last name',
                      },
                      {
                        min: 1,
                        message: 'Last name must be at least 1 character',
                      },
                      {
                        max: 32,
                        message: 'Last name must be at most 32 characters',
                      },
                    ]}
                  >
                    <Input allowClear={true} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    message: 'Please input your email',
                  },
                  {
                    type: 'email',
                    message: 'Please input a valid email',
                  },
                  {
                    min: 4,
                    message: 'Email must be at least 4 characters',
                  },
                  {
                    max: 64,
                    message: 'Email must be at most 64 characters',
                  },
                  {
                    warningOnly: true,
                    validator: async (_, value) => {
                      if (!value) return Promise.resolve()
                      if (!organization) {
                        return Promise.resolve()
                      }

                      try {
                        const ssoError = checkSsoEmailPatterns(value)
                        if (ssoError) {
                          return Promise.reject(ssoError)
                        }
                        return Promise.resolve()
                      } catch (err) {
                        console.error('Error in email validation:', err)
                        return Promise.resolve() // fallback to not blocking user
                      }
                    },
                  },
                ]}
              >
                <Input allowClear={true} type="email" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
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
                    max: 32,
                    message: 'Password must be at most 32 characters',
                  },
                ]}
              >
                <Input
                  allowClear={true}
                  type="password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Passwords do not match'))
                    },
                  }),
                ]}
              >
                <Input
                  allowClear={true}
                  type="password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                label="Student Number (Optional)"
                name="sid"
                rules={[
                  {
                    pattern: /^\d*$/,
                    message: 'Student number must be numeric',
                  },
                ]}
              >
                <Input allowClear={true} />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                className="h-auto w-full items-center justify-center rounded-lg border px-2 py-2"
              >
                <span className="font-semibold">Sign up</span>
              </Button>
            </Form>
          </Card>
        </div>
      )}
    </div>
  )
}
