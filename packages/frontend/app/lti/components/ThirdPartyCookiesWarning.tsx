import StandardPageContainer from '@/app/components/standardPageContainer'
import { Button, Result } from 'antd'
import Link from 'next/link'
import { ExpandOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

const ThirdPartyCookiesWarning: React.FC = () => {
  const pathname = usePathname()

  const courseId = useMemo(() => {
    const segments = pathname.split('/')
    let cid = segments[2] !== undefined ? parseInt(segments[2]) : undefined
    if (cid) {
      cid = isNaN(cid) ? undefined : cid
    }
    if (pathname.startsWith('/lti') && cid) {
      return cid
    }
    return undefined
  }, [pathname])

  const launchUrl = useMemo(() => {
    const qparams = '?launch_from_lti=true'
    const base = `${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' && process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}/`
    if (courseId) {
      return base + `course/${courseId}` + qparams
    }
    return base + qparams
  }, [courseId])

  return (
    <StandardPageContainer>
      <Result
        status="error"
        title="Third-Party Cookies Disabled"
        extra={[
          <div className="mt-12 flex flex-col gap-2 text-center" key="error">
            <p>Third-Party Cookies are required to use the HelpMe LTI tool.</p>
            <p>
              To use HelpMe, visit it in a dedicated tab or window by clicking
              the button below:
            </p>
            <div>
              <Link href={launchUrl} target={'_blank'}>
                <Button
                  variant={'solid'}
                  color={'primary'}
                  icon={<ExpandOutlined />}
                >
                  Open HelpMe In New Window
                </Button>
              </Link>
            </div>
          </div>,
        ]}
      />
    </StandardPageContainer>
  )
}

export default ThirdPartyCookiesWarning
