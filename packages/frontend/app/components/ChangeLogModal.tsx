import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import MarkdownCustom from './Markdown'
import { useUserInfo } from '../contexts/userContext'
import { OrganizationRole, Role } from '@koh/common'
import CenteredSpinner from './CenteredSpinner'

interface ChangeLogModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  onClose?: () => void
}

const ChangeLogModal: React.FC<ChangeLogModalProps> = ({
  isOpen,
  setIsOpen,
  onClose,
}) => {
  const { userInfo } = useUserInfo()
  const [currentChangeLog, setCurrentChangeLog] = useState<string>('')

  useEffect(() => {
    // make the changelog auto-open for admins and professors who haven't read it yet
    // (note: some profs may have the admin role, hence why we check for both)
    if (
      !userInfo?.readChangeLog &&
      (userInfo.organization?.organizationRole === OrganizationRole.ADMIN ||
        userInfo.organization?.organizationRole === OrganizationRole.PROFESSOR)
    ) {
      setIsOpen(true)
    }
  }, [userInfo, isOpen, setIsOpen])

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const response = await fetch('/changelog.md')
        const text = await response.text()
        setCurrentChangeLog(text)
      } catch (error) {
        console.error('Failed to fetch changelog:', error)
      }
    }

    fetchChangelog()
  }, [setCurrentChangeLog])

  return (
    <Modal
      title={<h1>What&apos;s New?</h1>}
      open={isOpen}
      closable
      footer={null}
      onCancel={() => {
        setIsOpen(false)
        onClose?.()
      }}
      width={{
        xs: '90%',
        sm: '85%',
        md: '80%',
        lg: '75%',
        xl: '70%',
        xxl: '65%',
      }}
      classNames={{
        header: 'flex items-center justify-center',
      }}
      className="box-border flex flex-col items-center justify-center"
    >
      <div className="childrenMarkdownFormatted box-border h-[60vh] w-full overflow-y-auto px-4 md:h-[75vh]">
        {currentChangeLog === '' ? (
          <CenteredSpinner tip="Fetching Changelog..." />
        ) : (
          <MarkdownCustom>{currentChangeLog}</MarkdownCustom>
        )}
      </div>
    </Modal>
  )
}
export default ChangeLogModal
