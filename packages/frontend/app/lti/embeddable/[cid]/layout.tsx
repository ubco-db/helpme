'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { Button, Card, Image } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { isProd } from '@koh/common'

export default function EmbeddableQuestionLayout({ children }: { children: ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  async function authCheck() {
    const result = await API.lti.auth.check();
    setIsAuthorized(result);
    return result;
  }

  useEffect(() => {
    (async () => authCheck())();
    let interval: any, checking = false;
    interval = setInterval(async () => {
      if (isAuthorized) {
        clearInterval(interval)
        interval = undefined;
      }
      try {
        if (checking) return;
        checking = true;
        setIsChecking(checking);
        const result = await authCheck();
        if (result) {
          clearInterval(interval);
          interval = undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setIsAuthorized(false);
      } finally {
        checking = false;
        setIsChecking(checking);
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style>{`
        html, body, #html {
          height: auto !important;
          min-height: 0 !important;
          background: transparent !important;
        }
        body {
          display: block !important;
          flex-grow: 0 !important;
        }
      `}</style>
      {!isAuthorized && (
        <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
          <Card
            title={'Authentication Required!'}
          >
            <p className="text-zinc-600">
              You cannot access this resource at this time. Try launching the HelpMe LTI tool - a
              link to launch the tool should be visible in your Canvas course&#39;s navigation bar.
              Contact your professor if this keeps happening after launching HelpMe.
            </p>
            <p className="text-zinc-600">
              Alternatively, launch HelpMe in a new tab via the button below and log in:
            </p>
            <Button
              type={'default'}
              target={'_blank'}
              icon={
                <span className={'flex justify-center items-center'}>
            <Image
              src={'/helpme_logo_small.png'}
              width={16}
              height={16}
              alt={'LTI'}
              preview={false}
            />
          </span>
              }
              href={`${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${isProd() ? '' : `:${process.env.NEXT_PUBLIC_DEV_PORT}`}/login`}
            >
              Launch HelpMe
            </Button>
            {isChecking && (
              <CenteredSpinner tip="Checking authentication state..." />
            )}
          </Card>
        </div>
      )}
      {children}
    </>
  )
}
