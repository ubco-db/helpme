import { API } from '@/app/api'
import MarkdownFetcherModal from '@/app/components/MarkdownFetcherModal'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { OrganizationRole } from '@koh/common'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from 'antd'

const FooterBar: React.FC = () => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const pathname = usePathname()
  const isLti = pathname.startsWith('/lti')

  const { userInfo, setUserInfo } = useUserInfo()

  const IReadTheChangelog = () => {
    if (userInfo?.readChangeLog) {
      return
    }
    setUserInfo({ ...userInfo, readChangeLog: true })

    const readChangelog = async () => {
      if (!userInfo?.readChangeLog) {
        try {
          await API.profile.readChangelog()
        } catch (error) {
          const errorMessage = getErrorMessage(error)
          console.error(
            'Failed to tell server that changelog was read:',
            errorMessage,
          )
        }
      }
    }

    readChangelog()
  }

  useEffect(() => {
    // make the changelog auto-open for admins and professors who haven't read it yet
    // (note: some profs may have the admin role, hence why we check for both)
    if (
      userInfo &&
      !userInfo.readChangeLog &&
      (userInfo.organization?.organizationRole === OrganizationRole.ADMIN ||
        userInfo.organization?.organizationRole === OrganizationRole.PROFESSOR)
    ) {
      setIsChangelogOpen(true)
    }
  }, [userInfo, setIsChangelogOpen])

  return (
    // On mobile it's the version in left corner, "About HelpMe" on right corner
    // On desktop it's "Version # | About HelpMe" in left corner, "Found a bug? ..." in right corner
    <footer
      className="mt-auto flex w-full justify-between bg-[#ebebeb] px-6 py-[0.3rem] text-xs"
      aria-hidden="true"
    >
      <div className="flex w-full justify-between md:block md:w-fit">
        <button
          className="cursor-pointer text-[#1677ff] transition-colors hover:text-[#69b1ff] active:text-[#0958d9]"
          onClick={() => {
            setIsChangelogOpen(true)
            IReadTheChangelog()
          }}
        >
          Version {process.env.NEXT_PUBLIC_HELPME_VERSION}{' '}
          {userInfo.readChangeLog === false && (
            <span className="text-green-500">(New Changes!)</span>
          )}
        </button>
        <MarkdownFetcherModal
          filename="changelog.md"
          isOpen={isChangelogOpen}
          setIsOpen={setIsChangelogOpen}
          onClose={IReadTheChangelog}
        />
        <span className="mx-4 hidden text-zinc-400 md:inline">|</span>
        <Link
          target={isLti ? '_blank' : undefined}
          rel={isLti ? 'noopener noreferrer' : undefined}
          href={isLti ? '/about' : '/profile/about'}
        >
          About HelpMe
        </Link>
      </div>
      <div className="hidden md:block">
        Found a bug? Have a suggestion? We welcome your feedback:
        <a
          aria-hidden="true"
          tabIndex={-1}
          href="mailto:adam.fipke@ubc.ca"
          className="ml-1 text-blue-600 underline"
        >
          adam.fipke@ubc.ca
        </a>
      </div>
    </footer>
  )
}

export default FooterBar
