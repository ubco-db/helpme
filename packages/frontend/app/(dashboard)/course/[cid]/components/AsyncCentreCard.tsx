'use client'

import { API } from '@/app/api'
import { Card } from 'antd'
import Link from 'next/link'
import React, { ReactElement, useEffect, useState } from 'react'

interface AsyncCentreCardProps {
  cid: number
  linkId: string
}

const AsyncCentreCard: React.FC<AsyncCentreCardProps> = ({
  cid,
  linkId,
}): ReactElement => {
  const [unreadCount, setUnreadCount] = useState<number>(0)

  useEffect(() => {
    API.course
      .getUnreadAsyncCount(cid)
      .then((response) => setUnreadCount(response.count))
  }, [setUnreadCount])

  return (
    <Link
      href={`/course/${cid}/async_centre`}
      aria-label="Anytime Question Hub"
      id={linkId}
    >
      <Card
        classNames={{
          header: 'text-white bg-[#3C426F] rounded-t-lg',
        }}
        className="asyncCentreCard my-4 rounded-t-lg"
        title={'Anytime Question Hub'}
        extra={
          unreadCount > 0 && (
            <div className="mr-8 h-fit text-sm font-normal text-gray-200">
              <span className="text-lg font-medium">{unreadCount}</span> Unread
              Question{unreadCount > 1 ? 's' : ''}
            </div>
          )
        }
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
