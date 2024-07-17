'use client'

import { RightOutlined } from '@ant-design/icons'
import { Card } from 'antd'
import Link from 'next/link'
import React, { ReactElement } from 'react'
import styles from './AsyncCentreCard.module.css'

interface AsyncCentreCardProps {
  cid: number
  linkId: string
}

const AsyncCentreCard: React.FC<AsyncCentreCardProps> = ({
  cid,
  linkId,
}): ReactElement => {
  return (
    <Link
      href={`/course/${cid}/async_question`}
      aria-label="Async Question Centre"
      id={linkId}
    >
      <Card
        headStyle={{
          background: 'rgb(60, 66, 111)',
          color: '#FFFFFF',
          borderRadius: '6px 6px 0 0',
        }}
        className={`${styles.asyncCentreCard} open-queue-card my-4`}
        title="Async Question Centre"
        extra={<RightOutlined className=" text-3xl text-gray-100" />}
      >
        <div className="flex items-center justify-between">
          <span className="text-md italic text-gray-600">
            Ask your questions any time!
          </span>
        </div>
      </Card>
    </Link>
  )
}

export default AsyncCentreCard
