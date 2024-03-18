import { LeftOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, Input, Row, message } from 'antd'
import Router from 'next/router'
import Head from 'next/head'
import { ReactElement, useEffect, useState } from 'react'
import styled from 'styled-components'
import ReCAPTCHA from 'react-google-recaptcha'
import React from 'react'

const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  text-align: center;
  padding-top: 100px;

  border-radius: 15px;
  height: auto;

  @media (max-width: 650px) {
    width: 90%;
  }

  @media (max-width: 992px) {
    width: 80%;
  }
`

export default function Register(): ReactElement {
  const [organizationId, setOrganizationId] = useState(0)

  useEffect(() => {
    setOrganizationId(parseInt(localStorage.getItem('organizationId')))
  }, [])

  const [registerForm] = Form.useForm()

  const recaptchaRef = React.createRef()

  const createAccount = async () => {
    const formValues = await registerForm.validateFields()
    const { firstName, lastName, email, password, confirmPassword, sid } =
      formValues

    if (isNaN(organizationId) || organizationId < 1) {
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
    const studentId = sid ? parseInt(sid) : null

    const token = await recaptchaRef.current.executeAsync()

    fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        sid: studentId,
        organizationId,
        recaptchaToken: token,
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          message.error(data.message)
          return
        } else {
          localStorage.removeItem('organizationId')
          Router.push('/courses')
        }
      })
      .catch(async (err) => {
        if (err && err.response) {
          message.error(err.response.data.message)
          return
        }
        message.error('Unknown error occurred. Please try again.')
        return
      })
  }

  const onReCAPTCHAChange = (captchaCode) => {
    if (!captchaCode) {
      return
    }

    recaptchaRef.current.reset()
  }

  return (
    <>
      <Head>
        <title>Create New Account | HelpMe</title>
      </Head>

      <Container>
        <Card className="mx-auto max-w-2xl sm:px-2 md:px-6">
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
            <ReCAPTCHA
              ref={recaptchaRef}
              size="invisible"
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
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
              <Input allowClear={true} type="password" />
            </Form.Item>

            <Form.Item
              label="Confirm Password"
              name="confirmPassword"
              rules={[
                { required: true, message: 'Please confirm your password' },
              ]}
            >
              <Input allowClear={true} type="password" />
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
      </Container>
    </>
  )
}
