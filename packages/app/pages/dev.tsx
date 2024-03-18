import { API } from '@koh/api-client'
import { isProd } from '@koh/common'
import { Button, Divider } from 'antd'
import DefaultErrorPage from 'next/error'
import React, { ReactElement } from 'react'
import styled from 'styled-components'
import { message } from 'antd'

const Container = styled.div`
  width: auto;
  height: auto;
  @media (max-width: 768px) {
    margin: 32px 24px;
  }
`

const SeedingContainer = styled.div`
  margin-left: auto;
  margin-right: auto;
  text-align: center;

  padding-top: 20px;
`

const PageHeader = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
`

export default function DevPanel(): ReactElement {
  if (isProd()) {
    return <DefaultErrorPage statusCode={404} />
  }
  return (
    <Container>
      <h1>
        <PageHeader>[ For Development Use Only ]</PageHeader>
      </h1>
      <SeedingContainer>
        <Divider plain>
          <h3>Seed</h3>
        </Divider>
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
                message.error(
                  `Error occurred while deleting the data: ${error.message}`,
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
                message.error(
                  `Error occurred while seeding data: ${error.message}`,
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
                message.error(
                  `Error occurred while adding questions to the queue: ${error.message}`,
                )
              })
          }}
        >
          Add Questions to Queue
        </Button>
      </SeedingContainer>
    </Container>
  )
}
