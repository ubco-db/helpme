'use client'

import { Button, Card, Col, Form, Input, message, Row } from 'antd'
import React, {
  ReactElement,
  Suspense,
  use,
  useEffect,
  useMemo,
  useState,
} from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { LeftOutlined } from '@ant-design/icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useLocalStorage } from '@/app/hooks/useLocalStorage'
import CenteredSpinner from '@/app/components/CenteredSpinner'

const parseFromParam = (oid: any) => {
  return parseInt(String(oid ?? ''))
}

export default function RegisterPage(props: {
  params: Promise<{ oid?: number }>
}): ReactElement {
  const params = use(props.params)

  const [storedId, setStoredId] = useLocalStorage<number>(
    'organizationId',
    null,
  )

  const organizationId = useMemo(
    () =>
      !isNaN(parseFromParam(params.oid))
        ? parseFromParam(params.oid)
        : !isNaN(parseInt(String(storedId)))
          ? parseInt(String(storedId))
          : undefined,
    [params.oid, storedId],
  )

  useEffect(() => {
    if (organizationId) {
      setStoredId(organizationId)
    }
  }, [organizationId])

  const [domLoaded, setDomLoaded] = useState(false)
  const router = useRouter()
  const pathName = usePathname()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  const [registerForm] = Form.useForm()
  const recaptchaRef = React.createRef<ReCAPTCHA>()

  async function onReCAPTCHAChange(captchaCode: string | null) {
    if (!captchaCode) return

    recaptchaRef?.current?.reset()
  }

  async function createAccount() {
    const formValues = await registerForm.validateFields()
    const { firstName, lastName, email, password, confirmPassword, sid } =
      formValues

    if (!organizationId || isNaN(organizationId)) {
      message.error('Organization not found.')
      return
    }

    if (sid && sid.trim().length < 1) {
      message.error('Student number must be at least 1 character')
      return
    }

    if (password !== confirmPassword) {
      message.error('Passwords do not match.')
      return
    }
    const studentId = !isNaN(parseInt(sid)) ? parseInt(sid) : undefined

    const token = await recaptchaRef?.current?.executeAsync()

    const registerParams = {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      sid: studentId,
      organizationId,
      recaptchaToken: token ?? '',
    }

    const response = await (
      isLti
        ? API.lti.auth.registerAccount(registerParams)
        : API.auth.registerAccount(registerParams)
    ).catch((err) => {
      message.error(getErrorMessage(err))
      return
    })

    if (!response) return

    router.push(redirect ? redirect : isLti ? '/lti' : '/courses')
  }

  useEffect(() => {
    setDomLoaded(true)
  }, [])

  if (!organizationId) {
    return (
      <Suspense fallback={<CenteredSpinner tip={'Loading...'} />}>
        <div className="mx-auto h-auto pt-20 text-center lg:container lg:mx-auto">
          <Card className="mx-auto max-w-max sm:px-2 md:px-6">
            <h2>No organization selected!</h2>
            <p>Cannot register an account without an organization selected.</p>
            <p>
              Return to the login page and select an organization which supports
              email-password registration:
            </p>
            <Button href={isLti ? '/lti/login' : '/login'}>
              Return to Login
            </Button>
          </Card>
        </div>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<CenteredSpinner tip={'Loading...'} />}>
      <div>
        {domLoaded && (
          <div className="mx-auto h-auto pt-20 text-center lg:container lg:mx-auto">
            <Card className="mx-auto max-w-max sm:px-2 md:px-6">
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
                  ]}
                >
                  <Input
                    allowClear={true}
                    type="password"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Form.Item label="Student Number" name="sid">
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
    </Suspense>
  )
}
