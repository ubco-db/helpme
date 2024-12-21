import { API } from '@/app/api'
import ChangeLogModal from '@/app/components/ChangeLogModal'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useState } from 'react'

const FooterBar: React.FC = () => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)

  const { userInfo, setUserInfo } = useUserInfo()

  const IReadTheChangelog = () => {
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

  return (
    // Hide footer on mobile since screen space is more valuable
    <footer
      className="mt-auto hidden w-full justify-between bg-[#ebebeb] px-6 py-[0.3rem] text-xs md:flex"
      aria-hidden="true"
    >
      <div>
        <a
          className="cursor-pointer "
          onClick={() => {
            setIsChangelogOpen(true)
            IReadTheChangelog()
          }}
        >
          Version 1.1.1{' '}
          {userInfo.readChangeLog === false && (
            <span className="text-green-500">(New Changes!)</span>
          )}
        </a>
        <ChangeLogModal
          isOpen={isChangelogOpen}
          setIsOpen={setIsChangelogOpen}
        />
      </div>
      <div>
        Found a bug? Have a suggestion? We welcome your feedback:
        <a
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
