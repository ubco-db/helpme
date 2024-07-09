'use client'

import { Card, Select } from 'antd'
import Head from 'next/head'
import { useState } from 'react'

export default function LoginPage() {
  const [pass, setPass] = useState('')
  const [uname, setUname] = useState('')
  const [accountActiveResponse, setAccountActiveResponse] = useState(true)
  const [loginMenu, setLoginMenu] = useState(false)

  return (
    <>
      <Head>
        <title>Login | HelpMe</title>
      </Head>
      <div className="container mx-auto h-auto w-1/2 pt-20 text-center">
        <Card className="mx-auto max-w-md sm:px-2 md:px-6">
          <h2 className="my-4 text-left">Login</h2>

          {!loginMenu && (
            <>
              <p className="text-left text-stone-400">
                Select your organization.
              </p>

              <Select
                className="mt-2 w-full text-left"
                placeholder="Available Organizations"
                // options={organizations.map((organization) => {
                //   return {
                //     label: organization.name,
                //     value: organization.id,
                //   }
                // })}
                // onChange={(value) => {
                //   showLoginMenu(value)
                // }}
              />
            </>
          )}
        </Card>
      </div>
    </>
  )
}
