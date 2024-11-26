import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import { useUserInfo } from '../contexts/userContext'
import MarkdownCustom from './Markdown'
import { API } from '../api'

interface ChangeLogModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

const ChangeLogModal: React.FC<ChangeLogModalProps> = ({
  isOpen,
  setIsOpen,
}) => {
  const { userInfo, setUserInfo } = useUserInfo()
  const [currentChangeLog, setCurrentChangeLog] = useState<string>('')

  useEffect(() => {
    if (!userInfo?.readChangeLog) {
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

  const onClose = () => {
    setIsOpen(false)
    setUserInfo({ ...userInfo, readChangeLog: true })

    const readChangelog = async () => {
      if (!userInfo?.readChangeLog) {
        try {
          await API.profile.readChangelog()
        } catch (error) {
          console.error('Failed to update user info:', error)
        }
      }
    }

    readChangelog()
  }

  return (
    <>
      <Modal
        open={isOpen}
        destroyOnClose
        closable
        footer={null}
        onCancel={onClose}
        width="auto"
        className="flex flex-col items-center justify-center overflow-y-auto"
      >
        <MarkdownCustom>{currentChangeLog}</MarkdownCustom>
      </Modal>
    </>
  )
}
export default ChangeLogModal
