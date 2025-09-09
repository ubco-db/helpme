'use client'
import { Button, Result, Spin, Typography } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import { use, useEffect, useMemo, useState } from 'react'
import StandardPageContainer from '@/app/components/standardPageContainer'

const { Paragraph, Text } = Typography

const FAILED_CODES: { [key: number]: string } = {
  40000: 'Organization not found',
  40001: 'Malformed request',
  40002: "Organization doesn't support SSO",
  40003: 'Missing or invalid authentication request state parameter',
  40004: 'Authentication request state expired',
}

const AuthFailed = (props: { params: Promise<{ code: string }> }) => {
  const params = use(props.params)
  const [code, setCode] = useState<string>()
  const router = useRouter()
  const pathName = usePathname()

  const isLti = useMemo(() => {
    return pathName.startsWith('/lti')
  }, [pathName])

  useEffect(() => {
    setCode(params.code)
  }, [params.code])

  return code && FAILED_CODES[Number(code)] ? (
    <>
      <StandardPageContainer>
        <Result
          status="error"
          title="Authentication Failed"
          extra={[
            <Button
              type="primary"
              className="m-auto h-auto w-2/5 items-center justify-center rounded-lg border px-5 py-3"
              key="login"
              onClick={() => router.push(isLti ? '/lti/login' : '/login')}
            >
              Go to Login Page
            </Button>,
            <div className="mt-12 text-center" key="error">
              <Paragraph>
                <Text strong className="text-lg">
                  The content you submitted has the following error:
                </Text>
              </Paragraph>
              <Paragraph>
                <CloseCircleOutlined /> {FAILED_CODES[Number(code)]}
              </Paragraph>
            </div>,
          ]}
        />
      </StandardPageContainer>
    </>
  ) : (
    <Spin />
  )
}

export default AuthFailed
