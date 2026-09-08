import StandardPageContainer from '@/app/components/standardPageContainer'
import { Button, Result } from 'antd'
import Link from 'next/link'
import { ExpandOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'

const ThirdPartyCookiesWarning: React.FC = () => {
  const pathname = usePathname()
  const isQuestion = pathname.startsWith('/lti/embeddable/')
  const courseId = Number(pathname.match(/^\/lti\/(?:embeddable\/)?(\d+)/)?.[1])
  const qparams = '?launch_from_lti=true'
  const launchUrl = courseId ? `/course/${courseId}${qparams}` : `/${qparams}`

  return (
    <StandardPageContainer>
      <Result
        status="error"
        title="Third-Party Cookies Disabled"
        extra={[
          <div className="mt-12 flex flex-col gap-2 text-center" key="error">
            {isQuestion ? (
              <>
                <p>
                  This Canvas question needs third-party site data so HelpMe can
                  keep the ordinary HelpMe LTI session secure.
                </p>
                <p>
                  Allow third-party site data for HelpMe, then reopen this quiz
                  in Canvas.
                </p>
              </>
            ) : (
              <>
                <p>Third-Party Cookies are required to use the HelpMe LTI tool.</p>
                <p>
                  To use HelpMe, visit it in a dedicated tab or window by
                  clicking the button below:
                </p>
                <div>
                  <Link href={launchUrl} target={'_blank'} prefetch={false}>
                    <Button
                      variant={'solid'}
                      color={'primary'}
                      icon={<ExpandOutlined />}
                    >
                      Open HelpMe In New Window
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>,
        ]}
      />
    </StandardPageContainer>
  )
}

export default ThirdPartyCookiesWarning
