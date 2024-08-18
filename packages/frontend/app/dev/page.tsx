'use client'

import { isProd } from '@koh/common'
import { Button, Divider } from 'antd'
import DefaultErrorPage from 'next/error'
import React, { ReactElement } from 'react'
import { message } from 'antd'
import { getErrorMessage } from '../utils/generalUtils'
import { API } from '../api'

export default function DevPanel(): ReactElement {
  if (isProd()) {
    // shouldn't be needed due to the redirect in layout.tsx but just in case
    return <DefaultErrorPage statusCode={404} />
  }
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-y-10">
      <h1>[ For Development Use Only ]</h1>
      <div className="flex flex-col items-center justify-center">
        <Divider plain>
          <h3>Seed</h3>
        </Divider>
        <div className="flex items-center justify-center">
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .delete()
                .then(() => {
                  message.success('Data deleted successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while deleting the data: ${errorMessage}`,
                  )
                })
            }}
          >
            Delete Data
          </Button>
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .create()
                .then(() => {
                  message.success('Data seeded successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while seeding data: ${errorMessage}`,
                  )
                })
            }}
          >
            Seed Data
          </Button>
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .fillQueue()
                .then(() => {
                  message.success('Queue filled successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while adding questions to the queue: ${errorMessage}`,
                  )
                })
            }}
          >
            Add Questions to Queue
          </Button>
        </div>
      </div>
    </div>
  )
}
