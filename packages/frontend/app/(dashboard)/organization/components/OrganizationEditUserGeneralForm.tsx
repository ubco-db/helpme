/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  GetOrganizationUserResponse,
} from '@koh/common'
import { Button, Form, Input, message, Spin } from 'antd'

type OrganizationEditUserGeneralFormProps = {
  userData: GetOrganizationUserResponse
  organization: GetOrganizationResponse
  fetchUserData: () => void
}

const OrganizationEditUserGeneralForm: React.FC<
  OrganizationEditUserGeneralFormProps
> = ({ userData, organization, fetchUserData }) => {
  const [formGeneral] = Form.useForm()

  const updateGeneral = async () => {
    const formValues = await formGeneral.validateFields()

    const firstNameField = formValues.firstName
    const lastNameField = formValues.lastName
    const emailField = formValues.email
    const sidField = formValues.sid

    if (
      firstNameField === userData?.user.firstName &&
      lastNameField === userData?.user.lastName &&
      emailField === userData?.user.email &&
      sidField === userData?.user.sid
    ) {
      message.info('User was not updated as information has not been changed')
      return
    }

    if (firstNameField.trim().length < 1) {
      message.error('First name must be at least 1 character')
      return
    }

    if (lastNameField.trim().length < 1) {
      message.error('Last name must be at least 1 character')
      return
    }

    if (emailField.trim().length < 4) {
      message.error('Email must be at least 4 characters')
      return
    }

    if (userData?.user.sid && sidField.trim().length < 1) {
      message.error('Student number must be at least 1 character')
      return
    }

    await API.organizations
      .patchUserInfo(organization.id, userData?.user.id, {
        firstName: firstNameField,
        lastName: lastNameField,
        email: emailField,
        sid: Number(sidField),
      })
      .then(() => {
        message.success('User information was updated')
        setTimeout(async () => {
          fetchUserData()
        }, 1750)
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  return userData ? (
    <Form
      form={formGeneral}
      layout="vertical"
      initialValues={{
        firstName: userData.user.firstName,
        lastName: userData.user.lastName,
        email: userData.user.email,
        sid: userData.user.sid,
      }}
      onFinish={updateGeneral}
    >
      <Form.Item
        label="First Name"
        name="firstName"
        tooltip="First name of the user"
      >
        <Input allowClear={true} disabled={organization?.ssoEnabled} />
      </Form.Item>

      <Form.Item
        label="Last Name"
        name="lastName"
        tooltip="Last name of the user"
      >
        <Input allowClear={true} disabled={organization?.ssoEnabled} />
      </Form.Item>

      <Form.Item label="Email" name="email" tooltip="Email address of the user">
        <Input
          allowClear={true}
          type="email"
          disabled={organization?.ssoEnabled}
        />
      </Form.Item>

      <Form.Item
        label="Student Number"
        name="sid"
        tooltip="Student number of the user"
      >
        <Input allowClear={true} disabled={organization?.ssoEnabled} />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          className="h-auto w-full p-3"
          disabled={organization?.ssoEnabled}
        >
          Update
        </Button>
      </Form.Item>
    </Form>
  ) : (
    <Spin />
  )
}

export default OrganizationEditUserGeneralForm
