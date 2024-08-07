'use client'

import {
  AccountType,
  GetProfileResponse,
  UpdateProfileParams,
} from '@koh/common'
import { Button, Card, Col, Form, Input, message, Row } from 'antd'
import { useState } from 'react'
import useSWR from 'swr'
import { pick } from 'lodash'
import { API } from '@/app/api'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'

const EditProfile: React.FC = () => {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )
  const [form] = Form.useForm()
  const { userInfo, setUserInfo } = useUserInfo()

  const [screenReaderMessage, setScreenReaderMessage] = useState(' ')

  const editProfile = async (updateProfile: UpdateProfileParams) => {
    let newProfile = null

    if (profile && profile.accountType === AccountType.LEGACY) {
      newProfile = { ...profile, ...updateProfile }
      newProfile.sid = parseInt(`${newProfile.sid}`, 10)
      if (profile.email === updateProfile.email) {
        await API.profile
          .patch(pick(newProfile, ['firstName', 'lastName', 'sid']))
          .catch((error) => {
            const errorMessage = getErrorMessage(error)
            message.error('Error updating profile:', errorMessage)
          })
      } else {
        await API.profile
          .patch(pick(newProfile, ['firstName', 'lastName', 'email', 'sid']))
          .catch((error) => {
            const errorMessage = getErrorMessage(error)
            message.error('Error updating profile:', errorMessage)
          })
      }
    } else {
      newProfile = {
        ...profile,
        ...{
          firstName: updateProfile.firstName,
          lastName: updateProfile.lastName,
          sid: updateProfile.sid,
        },
      }
      newProfile.sid = parseInt(`${newProfile.sid}`, 10)
      await API.profile
        .patch(pick(newProfile, ['firstName', 'lastName', 'sid']))
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Error updating profile:', errorMessage)
        })
    }

    const newUser = await mutate() //update the context
    setUserInfo({ ...userInfo, ...newUser })
    return newProfile
  }

  const handleOk = async () => {
    const value = await form.validateFields()
    const newProfile = await editProfile(value)
    if (!newProfile) return

    form.setFieldsValue(newProfile)
    message.success('Your profile settings have been successfully updated')
    setScreenReaderMessage(
      'Your profile settings have been successfully updated',
    )
  }

  if (!profile) {
    return <CenteredSpinner tip="Loading Profile..." />
  } else {
    return (
      <div>
        <div aria-live="polite" className="sr-only">
          {screenReaderMessage}
        </div>
        <Card title="Personal Information" className="mt-5">
          <Form
            wrapperCol={{ span: 24 }}
            form={form}
            initialValues={profile}
            layout="vertical"
          >
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
              <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[
                    {
                      required: true,
                      message: "Your name can't be empty!",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>

              <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[
                    {
                      required: true,
                      message: "Your name can't be empty!",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
              <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    {
                      required: profile.accountType === AccountType.LEGACY,
                      message: "Your email can't be empty!",
                    },
                  ]}
                >
                  <Input
                    disabled={profile.accountType !== AccountType.LEGACY}
                  />
                </Form.Item>
              </Col>

              <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                <Form.Item label="Student ID" name="sid">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Button
            key="submit"
            htmlType="submit"
            type="primary"
            block
            onClick={handleOk}
            className="rounded p-4"
          >
            Save
          </Button>
        </Card>
      </div>
    )
  }
}

export default EditProfile