import StandardPageContainer from '@/app/components/standardPageContainer'
import { Button, Result } from 'antd'
import Link from 'next/link'
import { ExpandOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const ThirdPartyCookiesWarning: React.FC = () => {
  const [canRequestAccess, setCanRequestAccess] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false)
  const pathname = usePathname()
  const isQuestion = pathname.startsWith('/lti/embeddable/')
  const courseId = Number(pathname.match(/^\/lti\/(?:embeddable\/)?(\d+)/)?.[1])
  const qparams = '?launch_from_lti=true'
  const launchUrl = courseId ? `/course/${courseId}${qparams}` : `/${qparams}`

  useEffect(() => {
    setCanRequestAccess(typeof document.requestStorageAccess === 'function')
  }, [])

  const requestAccess = async () => {
    setRequestFailed(false)
    try {
      await document.requestStorageAccess()
      if (pathname.startsWith('/failed/')) {
        setAccessGranted(true)
      } else {
        window.location.reload()
      }
    } catch {
      setRequestFailed(true)
    }
  }

  return (
    <StandardPageContainer>
      <Result
        status="error"
        title="Third-Party Cookies Disabled"
        extra={[
          <div className="mt-12 flex flex-col gap-2 text-center" key="error">
            <p>
              {isQuestion ? 'This question' : 'HelpMe'} needs third-party
              cookies to keep you signed in inside your learning platform.
            </p>
            <p>
              Allow third-party cookies for HelpMe in your browser settings,
              then refresh this page.
            </p>
            {canRequestAccess && !accessGranted && (
              <div>
                <Button onClick={requestAccess}>Allow cookie access</Button>
              </div>
            )}
            {accessGranted && (
              <p>
                Your browser accepted the request. Reopen the question in your
                learning platform.
              </p>
            )}
            {requestFailed && (
              <p>Cookie access was not granted. Try your browser settings.</p>
            )}
            <div>
              <Button onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </div>
            <p>
              You can also open HelpMe in a separate window to sign in. You may
              still need to allow cookies and reopen the question in your
              learning platform.
            </p>
            <div>
              <Link
                href={launchUrl}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
              >
                <Button type="primary" icon={<ExpandOutlined />}>
                  Open HelpMe in a new window
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
