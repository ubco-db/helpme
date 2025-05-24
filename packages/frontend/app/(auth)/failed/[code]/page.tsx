'use client'
import { Typography, Result, Spin, Button } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import StandardPageContainer from '@/app/components/standardPageContainer'

const { Paragraph, Text } = Typography

const FAILED_CODES: { [key: number]: string } = {
  40000: 'Organization not found',
  40001: 'Malformed request',
  40002: "Organization doesn't support SSO",
}

const AuthFailed = (props: { params: Promise<{ code: string }> }) => {
  const params = use(props.params)
  const [code, setCode] = useState<string>()
  const router = useRouter()

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
              onClick={() => router.push('/login')}
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
